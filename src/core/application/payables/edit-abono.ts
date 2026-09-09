import { Payable } from '../../domain/payable';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { payableCategory } from '../../domain/synthetic-categories';
import type { PayableRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import type { EditAbonoInput } from './dto/payables';

/**
 * Edit an embedded abono on a payable (PAY-R-3).
 *
 * Recalculates pending with the new amount and updates the linked movement
 * via abono.movementId — embedded abono and movement move together.
 *
 * R15 Fase 3: aggregate read + pending recomputation run INSIDE the
 * transaction (snapshot-consistent), and the two writes (abono $set + linked
 * movement update) commit or roll back atomically. The linked-movement re-read
 * (movementRepo.findById) has no transaction handle — the movement pre-exists
 * and the read only merges its unchanged fields, so it stays session-less.
 */
export async function editAbono(
  workspaceId: string,
  payableId: string,
  abonoId: string,
  input: EditAbonoInput,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<Payable> {
  return uow.withTransaction(async (tx) => {
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const payables = await payableRepo.findByWorkspaceId(workspaceId, tx);
    const payable = payables.find(p => p.id === payableId);
    if (!payable) throw new NotFoundError('Payable not found');

    const abono = payable.abonos.find(a => a.id === abonoId);
    if (!abono) throw new NotFoundError('Abono not found');

    // PAY-R-2: recalculate pending with new amount
    if (input.amount !== undefined) {
      const otherAbonos = payable.abonos.filter(a => a.id !== abonoId);
      const totalOther = otherAbonos.reduce((sum, a) => sum + a.amount.amount, 0);
      const pending = payable.total.amount - payable.initialPayment - totalOther;
      if (input.amount > pending) {
        throw new ConflictError('Abono exceeds pending amount');
      }
    }

    const updatedAmount = input.amount ? new Money(input.amount, abono.amount.currency) : abono.amount;
    const updatedAccountId = input.accountId ?? abono.accountId;
    const updatedDate = input.date ?? abono.date;

    await payableRepo.editAbono(workspaceId, payableId, abonoId, {
      amount: input.amount,
      date: input.date,
    }, tx, payable.version);

    // Update linked movement (cascade via abono.movementId)
    if (abono.movementId) {
      const movement = await movementRepo.findById(workspaceId, abono.movementId);
      if (movement) {
        const updatedMovement = new Movement({
          id: movement.id,
          workspaceId: movement.workspaceId,
          accountId: updatedAccountId,
          category: payableCategory('expense'),
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

    return new Payable(
      {
        id: payable.id,
        workspaceId: payable.workspaceId,
        counterparty: payable.counterparty,
        total: payable.total,
        initialPayment: payable.initialPayment,
        accountId: payable.accountId,
        date: payable.date,
        dueDate: payable.dueDate,
        note: payable.note,
        createdAt: payable.createdAt,
        version: payable.version + 1,
      },
      payable.abonos.map(a =>
        a.id === abonoId
          ? { id: a.id, amount: updatedAmount, date: updatedDate, accountId: updatedAccountId, movementId: a.movementId }
          : a,
      ),
    );
  });
}