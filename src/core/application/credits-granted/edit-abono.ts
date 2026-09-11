import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money, assertSafeMinorUnits } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { isModernRecord } from '../../domain/modern-record';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { EditAbonoInput } from './dto/credits-granted';
import { splitAbonoCapitalInterest } from './split-abono';

/**
 * Edit an embedded abono on a credit granted (CRED-G-4).
 *
 * Recalculates pending with the new amount and updates the linked movement.
 *
 * R9/D9.3 — split synchronization: for a standalone credit (no POS sale) whose
 * abono already carries split markers (capitalAmount / interestAmount /
 * interestMovementId), editing recomputes the chronological capital/interest
 * split for the new amount and synchronizes BOTH movements:
 *   - the primary (capital) movement, kind `creditGrantedAbono`;
 *   - the interest movement, kind `creditGrantedAbonoInterest` — created when a
 *     portion appears, updated when it persists, and deleted (movement first,
 *     R5-B) when the new amount leaves no interest.
 * A 100%-interest abono has its primary movement be the interest one; since a
 * recovered principal stays recovered, its amount can only grow the interest
 * portion, so the primary ever remains the interest movement.
 *
 * The abono embedded keeps its TOTAL amount; the split markers are informative.
 * Abonos created before R9 (no split markers) keep the legacy single-movement
 * behavior — this is required so historical data and its tests stay intact.
 *
 * R15 Fase 3: aggregate read + pending recomputation run INSIDE the
 * transaction (snapshot-consistent), and ALL writes (movement delete/update/
 * create in R5-B order + abono $set) commit or roll back atomically. The
 * movement re-reads (movementRepo.findById) have no transaction handle — the
 * movements pre-exist and the reads only merge unchanged fields.
 */
export async function editAbono(
  workspaceId: string,
  creditId: string,
  abonoId: string,
  input: EditAbonoInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  uow: UnitOfWork,
): Promise<CreditGranted> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    const abono = credit.abonos.find(a => a.id === abonoId);
    if (!abono) throw new NotFoundError('Abono not found');

    // CRED-G-2: recalculate pending with new amount
    if (input.amount !== undefined) {
      const otherAbonos = credit.abonos.filter(a => a.id !== abonoId);
      const totalOther = otherAbonos.reduce((sum, a) => sum + a.amount.amount, 0);
      // R15.3 §18: the intermediate sum and the derived pending must stay safe
      // integers before the overpayment comparison.
      assertSafeMinorUnits(totalOther, "EditAbono other abonos sum");
      const pending = credit.totalToPay - totalOther;
      assertSafeMinorUnits(pending, "EditAbono pending");
      if (input.amount > pending) {
        throw new ConflictError('Abono exceeds pending amount');
      }
    }

    const updatedAmount = input.amount ? new Money(input.amount, abono.amount.currency) : abono.amount;
    // R15.3 §16: the abono keeps its original account — editing is amount/date
    // only, changing the account is not a product capability.
    const updatedAccountId = abono.accountId;
    const updatedDate = input.date ?? abono.date;

    const isSplitAbono =
      !credit.saleId &&
      (abono.capitalAmount !== undefined ||
        abono.interestAmount !== undefined ||
        abono.interestMovementId !== undefined);

    if (isSplitAbono) {
      // Recompute the chronological split keeping the edited abono at its
      // position: abonos BEFORE it consume capital first, so the edited abono
      // grabs the remaining recoverable capital greedily. The other entries are
      // only inputs to the allocation — only the edited abono's split is used.
      const editedIndex = credit.abonos.findIndex(a => a.id === abonoId);
      const allWithEdited = credit.abonos.map(a =>
        a.id === abonoId ? { amount: updatedAmount.amount } : { amount: a.amount.amount },
      );
      const recomputed = splitAbonoCapitalInterest(credit.principal.amount, allWithEdited);
      const split = recomputed[editedIndex];

      // ── Movements first (convergent writes; delete-interest before the abono
      //    persist so a mid-way failure never orphans a phantom interest income).
      let interestMovementId = abono.interestMovementId;

      if (split.interestAmount === 0 && abono.interestMovementId) {
        try {
          await movementRepo.delete(workspaceId, abono.interestMovementId, tx);
        } catch (err) {
          // tolerant: already-missing interest movement is fine
          if (!(err instanceof NotFoundError)) throw err;
        }
        interestMovementId = undefined;
      }

      if (split.interestAmount > 0) {
        if (abono.interestMovementId) {
          const movement = await movementRepo.findById(workspaceId, abono.interestMovementId);
          if (!movement) {
            // R15.1 6c: the split abono carries an interestMovementId, so its
            // interest movement is REQUIRED for modern records.
            if (isModernRecord(credit.createdAt)) {
              throw new ConflictError('Required movement not found for modern record');
            }
            console.warn('[reconcile] Legacy record missing movement, continuing', {
              aggregateId: credit.id,
              movementId: abono.interestMovementId,
            });
          } else {
            await movementRepo.update(
              new Movement({
                id: movement.id,
                workspaceId: movement.workspaceId,
                accountId: updatedAccountId,
                category: creditGrantedCategory('income'),
                type: 'income',
                amount: new Money(split.interestAmount, updatedAmount.currency),
                date: updatedDate,
                note: movement.note,
                context: movement.context,
                link: movement.link,
                createdAt: movement.createdAt,
              }),
              tx,
            );
          }
        } else if (split.capitalAmount > 0) {
          // A new interest portion appeared (full-capital abono edited upward):
          // create the interest movement and link it from the abono. In the
          // 100%-interest case the primary movement IS the interest movement, so
          // no extra movement is created here (updated below).
          interestMovementId = ids.generate();
          await movementRepo.create(
            new Movement({
              id: interestMovementId,
              workspaceId,
              accountId: updatedAccountId,
              category: creditGrantedCategory('income'),
              type: 'income',
              amount: new Money(split.interestAmount, updatedAmount.currency),
              date: updatedDate,
              // No persisted note: display text derives at render from link.kind.
              context: 'Personal',
              link: { kind: 'creditGrantedAbonoInterest', refId: creditId, opId: ids.generate() },
              createdAt: new Date(),
            }),
            tx,
          );
        }
      }

      if (split.capitalAmount > 0 && abono.movementId) {
        // Primary capital movement — sync its amount. (Only the 100%-interest
        // abono has no capital movement; that case is handled below.)
        const movement = await movementRepo.findById(workspaceId, abono.movementId);
        if (!movement) {
          // R15.1 6c: abono.movementId is set, so the primary movement is
          // REQUIRED for modern records.
          if (isModernRecord(credit.createdAt)) {
            throw new ConflictError('Required movement not found for modern record');
          }
          console.warn('[reconcile] Legacy record missing movement, continuing', {
            aggregateId: credit.id,
            movementId: abono.movementId,
          });
        } else {
          await movementRepo.update(
            new Movement({
              id: movement.id,
              workspaceId: movement.workspaceId,
              accountId: updatedAccountId,
              category: creditGrantedCategory('income'),
              type: 'income',
              amount: new Money(split.capitalAmount, updatedAmount.currency),
              date: updatedDate,
              note: movement.note,
              context: movement.context,
              link: movement.link,
              createdAt: movement.createdAt,
            }),
            tx,
          );
        }
      } else if (abono.movementId) {
        // 100%-interest abono: the primary movement IS the interest movement.
        const movement = await movementRepo.findById(workspaceId, abono.movementId);
        if (!movement) {
          // R15.1 6c: abono.movementId is set, so the primary movement is
          // REQUIRED for modern records.
          if (isModernRecord(credit.createdAt)) {
            throw new ConflictError('Required movement not found for modern record');
          }
          console.warn('[reconcile] Legacy record missing movement, continuing', {
            aggregateId: credit.id,
            movementId: abono.movementId,
          });
        } else {
          await movementRepo.update(
            new Movement({
              id: movement.id,
              workspaceId: movement.workspaceId,
              accountId: updatedAccountId,
              category: creditGrantedCategory('income'),
              type: 'income',
              amount: new Money(split.interestAmount, updatedAmount.currency),
              date: updatedDate,
              note: movement.note,
              context: movement.context,
              link: movement.link,
              createdAt: movement.createdAt,
            }),
            tx,
          );
        }
      }

      // ── Persist the abono (resolved amounts; undefined → $unset clears the
      //    dropped markers so the split stays self-consistent).
      await creditRepo.editAbono(workspaceId, creditId, abonoId, {
        amount: updatedAmount.amount,
        date: updatedDate,
        capitalAmount: split.capitalAmount > 0 ? split.capitalAmount : undefined,
        interestAmount: split.interestAmount > 0 ? split.interestAmount : undefined,
        interestMovementId,
      }, tx, credit.version);

      return new CreditGranted(
        {
          id: credit.id,
          workspaceId: credit.workspaceId,
          counterparty: credit.counterparty,
          principal: credit.principal,
          accountId: credit.accountId,
          date: credit.date,
          installments: credit.installments,
          installmentValue: credit.installmentValue,
          frequency: credit.frequency,
          saleId: credit.saleId,
          writtenOff: credit.writtenOff,
          createdAt: credit.createdAt,
          version: credit.version + 1,
        },
        credit.abonos.map(a =>
          a.id === abonoId
            ? {
                id: a.id,
                amount: updatedAmount,
                date: updatedDate,
                accountId: updatedAccountId,
                movementId: a.movementId,
                capitalAmount:
                  split.capitalAmount > 0
                    ? new Money(split.capitalAmount, updatedAmount.currency)
                    : undefined,
                interestAmount:
                  split.interestAmount > 0
                    ? new Money(split.interestAmount, updatedAmount.currency)
                    : undefined,
                interestMovementId,
              }
            : a,
        ),
      );
    }

    // ── Legacy single-movement path (sale-born + pre-R9 abonos) ──────────────
    // Resolved values only — passing `undefined` to the repository would $unset
    // the field (undefined → $unset contract), clearing amounts by accident.
    // The movement read happens BEFORE the abono write so a missing required
    // movement aborts the whole transaction without any partial write.
    if (abono.movementId) {
      const movement = await movementRepo.findById(workspaceId, abono.movementId);
      if (!movement) {
        // R15.1 6c: modern aggregates must keep their required movement — a
        // missing one is an integrity violation (ConflictError + rollback).
        // Legacy aggregates keep the tolerant behavior with a reconciliation log.
        if (isModernRecord(credit.createdAt)) {
          throw new ConflictError('Required movement not found for modern record');
        }
        console.warn('[reconcile] Legacy record missing movement, continuing', {
          aggregateId: credit.id,
          movementId: abono.movementId,
        });
      } else {
        const updatedMovement = new Movement({
          id: movement.id,
          workspaceId: movement.workspaceId,
          accountId: updatedAccountId,
          category: creditGrantedCategory('income'),
          type: 'income',
          amount: updatedAmount,
          date: updatedDate,
          note: movement.note,
          // Legacy single-movement path is only reached for sale-born credits
          // (this branch never applies to split standalone abonos). Reclassify
          // a historically-wrong 'Personal' context to 'Business' so the abono
          // counts toward economic result, matching the POS initial payment.
          context: credit.saleId ? 'Business' : movement.context,
          link: movement.link,
          createdAt: movement.createdAt,
        });
        await movementRepo.update(updatedMovement, tx);
      }
    }

    await creditRepo.editAbono(workspaceId, creditId, abonoId, {
      amount: updatedAmount.amount,
      date: updatedDate,
    }, tx, credit.version);

    return new CreditGranted(
      {
        id: credit.id,
        workspaceId: credit.workspaceId,
        counterparty: credit.counterparty,
        principal: credit.principal,
        accountId: credit.accountId,
        date: credit.date,
        installments: credit.installments,
        installmentValue: credit.installmentValue,
        frequency: credit.frequency,
        saleId: credit.saleId,
        writtenOff: credit.writtenOff,
        createdAt: credit.createdAt,
        version: credit.version + 1,
      },
      credit.abonos.map(a =>
        a.id === abonoId
          ? { id: a.id, amount: updatedAmount, date: updatedDate, accountId: updatedAccountId, movementId: a.movementId }
          : a,
      ),
    );
  });
}