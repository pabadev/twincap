import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money, assertSafeMinorUnits } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { isModernRecord } from '../../domain/modern-record';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import type { EditAbonoInput } from './dto/credits-received';

/**
 * Edit an embedded abono on a credit received (CRED-R-4).
 *
 * Recalculates pending with the new amount and updates the linked movement.
 *
 * R15 Fase 3: aggregate read + pending recomputation run INSIDE the
 * transaction (snapshot-consistent), and the two writes (abono $set + linked
 * movement update) commit or roll back atomically. The linked-movement re-read
 * (movementRepo.findById) has no transaction handle — the movement pre-exists
 * and the read only merges its unchanged fields, so it stays session-less.
 */
export async function editAbono(
  workspaceId: string,
  creditId: string,
  abonoId: string,
  input: EditAbonoInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<CreditReceived> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const credits = await creditRepo.findByWorkspaceId(workspaceId, tx);
    const credit = credits.find(c => c.id === creditId);
    if (!credit) throw new NotFoundError('Credit not found');

    const abono = credit.abonos.find(a => a.id === abonoId);
    if (!abono) throw new NotFoundError('Abono not found');

    // CRED-R-2: recalculate pending with new amount
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

    // Update linked movement. The read happens BEFORE the abono write so a
    // missing required movement aborts the whole transaction without any
    // partial write (fail fast, same tx rollback).
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
          category: creditCategory('expense'),
          type: 'expense',
          amount: updatedAmount,
          date: updatedDate,
          note: movement.note,
          context: movement.context,
          link: movement.link,
          createdAt: movement.createdAt,
        });
        await movementRepo.update(updatedMovement, tx);
      }
    }

    await creditRepo.editAbono(workspaceId, creditId, abonoId, {
      amount: input.amount,
      date: input.date,
    }, tx, credit.version);

    return new CreditReceived(
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