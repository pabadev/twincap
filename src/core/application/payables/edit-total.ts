import { Payable } from '../../domain/payable';
import { Money, assertSafeMinorUnits } from '../../domain/money';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import type { PayableRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import type { EditTotalInput } from './dto/payables';

/**
 * Edit the total of a payable (PAY-R-4).
 *
 * The new total must cover everything already paid
 * (total >= initialPayment + Σ abonos) so pending never goes negative.
 * NO movement cascade: the purchase itself has no principal movement, and
 * initial payment/abono movements are independent of the total.
 *
 * R15.3 §6 — optimistic concurrency: the payable is re-read INSIDE the
 * transaction snapshot and the write carries `payable.version` as the CAS
 * expected version (`__v` bump). A concurrent editTotal, addAbono or
 * deleteAbono that commits first makes this snapshot stale → the write
 * aborts with ConflictError(DEBT_MODIFIED_MSG) and the whole edit rolls
 * back — no lost update, no partially-edited document. All reads over the
 * same session stay strictly SERIAL (driver error 251 on concurrent use).
 */
export async function editTotal(
  workspaceId: string,
  payableId: string,
  input: EditTotalInput,
  payableRepo: PayableRepository,
  uow: UnitOfWork,
): Promise<Payable> {
  return uow.withTransaction(async (tx) => {
    const payable = await payableRepo.findById(workspaceId, payableId, tx);
    if (!payable) throw new NotFoundError('Payable not found');

    // ACC-1: total currency is immutable.
    if (input.currency !== payable.total.currency) {
      throw new ValidationError(`Payable currency is ${payable.total.currency}, declared ${input.currency}`);
    }

    // PAY-R-4: pending must remain >= 0
    const totalAbonos = payable.abonos.reduce((sum, a) => sum + a.amount.amount, 0);
    // R15.3 §18: the paid-so-far aggregation must stay a safe integer before
    // it is compared against the new total.
    assertSafeMinorUnits(totalAbonos, "Payable edit-total abonos sum");
    const paidSoFar = payable.initialPayment + totalAbonos;
    assertSafeMinorUnits(paidSoFar, "Payable edit-total paid so far");
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
    await payableRepo.update(updatedPayable, tx, payable.version);

    return updatedPayable;
  });
}
