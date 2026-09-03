import { Payable } from '../../domain/payable';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import type { PayableRepository } from '../../domain/repositories';
import type { EditTotalInput } from './dto/payables';

/**
 * Edit the total of a payable (PAY-R-4).
 *
 * The new total must cover everything already paid
 * (total >= initialPayment + Σ abonos) so pending never goes negative.
 * NO movement cascade: the purchase itself has no principal movement, and
 * initial payment/abono movements are independent of the total.
 */
export async function editTotal(
  workspaceId: string,
  payableId: string,
  input: EditTotalInput,
  payableRepo: PayableRepository,
): Promise<Payable> {
  const payables = await payableRepo.findByWorkspaceId(workspaceId);
  const payable = payables.find(p => p.id === payableId);
  if (!payable) throw new NotFoundError('Payable not found');

  // PAY-R-4: pending must remain >= 0
  const totalAbonos = payable.abonos.reduce((sum, a) => sum + a.amount.amount, 0);
  const paidSoFar = payable.initialPayment + totalAbonos;
  if (input.total < paidSoFar) {
    throw new ConflictError('New total is less than amount already paid');
  }

  const updatedPayable = new Payable(
    {
      id: payable.id,
      workspaceId: payable.workspaceId,
      counterparty: payable.counterparty,
      total: new Money(input.total, input.currency),
      initialPayment: payable.initialPayment,
      accountId: payable.accountId,
      date: payable.date,
      dueDate: payable.dueDate,
      note: payable.note,
      createdAt: payable.createdAt,
    },
    [...payable.abonos],
  );
  await payableRepo.update(updatedPayable);

  return updatedPayable;
}
