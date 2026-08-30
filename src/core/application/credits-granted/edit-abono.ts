import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
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
 */
export async function editAbono(
  userId: string,
  creditId: string,
  abonoId: string,
  input: EditAbonoInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<CreditGranted> {
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  const abono = credit.abonos.find(a => a.id === abonoId);
  if (!abono) throw new NotFoundError('Abono not found');

  // CRED-G-2: recalculate pending with new amount
  if (input.amount !== undefined) {
    const otherAbonos = credit.abonos.filter(a => a.id !== abonoId);
    const totalOther = otherAbonos.reduce((sum, a) => sum + a.amount.amount, 0);
    const pending = credit.totalToPay - totalOther;
    if (input.amount > pending) {
      throw new ConflictError('Abono exceeds pending amount');
    }
  }

  const updatedAmount = input.amount ? new Money(input.amount, abono.amount.currency) : abono.amount;
  const updatedAccountId = input.accountId ?? abono.accountId;
  const updatedDate = input.date ?? abono.date;

  const isSplitAbono =
    !credit.saleId &&
    (abono.capitalAmount !== undefined ||
      abono.interestAmount !== undefined ||
      abono.interestMovementId !== undefined);

  // Atomicity note: credit + linked movements are separate writes inside this
  // single use-case invocation. Full transactionality would require the
  // repository ports to accept a Mongoose ClientSession (signature change
  // across every port/implementation) plus a replica-set connection — an
  // infrastructure change deliberately out of scope here.
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
        await movementRepo.delete(userId, abono.interestMovementId);
      } catch (err) {
        // tolerant: already-missing interest movement is fine
        if (!(err instanceof NotFoundError)) throw err;
      }
      interestMovementId = undefined;
    }

    if (split.interestAmount > 0) {
      if (abono.interestMovementId) {
        const movement = await movementRepo.findById(userId, abono.interestMovementId);
        if (movement) {
          await movementRepo.update(
            new Movement({
              id: movement.id,
              userId: movement.userId,
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
            userId,
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
        );
      }
    }

    if (split.capitalAmount > 0 && abono.movementId) {
      // Primary capital movement — sync its amount. (Only the 100%-interest
      // abono has no capital movement; that case is handled below.)
      const movement = await movementRepo.findById(userId, abono.movementId);
      if (movement) {
        await movementRepo.update(
          new Movement({
            id: movement.id,
            userId: movement.userId,
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
        );
      }
    } else if (abono.movementId) {
      // 100%-interest abono: the primary movement IS the interest movement.
      const movement = await movementRepo.findById(userId, abono.movementId);
      if (movement) {
        await movementRepo.update(
          new Movement({
            id: movement.id,
            userId: movement.userId,
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
        );
      }
    }

    // ── Persist the abono (resolved amounts; undefined → $unset clears the
    //    dropped markers so the split stays self-consistent).
    await creditRepo.editAbono(userId, creditId, abonoId, {
      amount: updatedAmount.amount,
      date: updatedDate,
      capitalAmount: split.capitalAmount > 0 ? split.capitalAmount : undefined,
      interestAmount: split.interestAmount > 0 ? split.interestAmount : undefined,
      interestMovementId,
    });

    return new CreditGranted(
      {
        id: credit.id,
        userId: credit.userId,
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
  await creditRepo.editAbono(userId, creditId, abonoId, {
    amount: updatedAmount.amount,
    date: updatedDate,
  });

  // Update linked movement (income type for abonos)
  if (abono.movementId) {
    const movement = await movementRepo.findById(userId, abono.movementId);
    if (movement) {
      const updatedMovement = new Movement({
        id: movement.id,
        userId: movement.userId,
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
      await movementRepo.update(updatedMovement);
    }
  }

  return new CreditGranted(
    {
      id: credit.id,
      userId: credit.userId,
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
    },
    credit.abonos.map(a =>
      a.id === abonoId
        ? { id: a.id, amount: updatedAmount, date: updatedDate, accountId: updatedAccountId, movementId: a.movementId }
        : a,
    ),
  );
}