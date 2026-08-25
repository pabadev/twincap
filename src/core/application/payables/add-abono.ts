import { Payable } from '../../domain/payable';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { payableCategory } from '../../domain/synthetic-categories';
import type { PayableRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { AddAbonoInput } from './dto/payables';

/**
 * Add an abono (payment) to a payable (PAY-R-2).
 *
 * Pending = total − initialPayment − Σ abonos. Overpayment is rejected.
 * Produces exactly ONE linked expense movement (kind 'payableAbono').
 */
export async function addAbono(
  userId: string,
  payableId: string,
  input: AddAbonoInput,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<Payable> {
  // Re-fetch via repo — returns Payable instance with pending getter
  const payables = await payableRepo.findByUserId(userId);
  const payable = payables.find(p => p.id === payableId);
  if (!payable) throw new NotFoundError('Payable not found');

  // PAY-R-2: pending = total − initialPayment − Σ abonos; overpayment rejected
  if (input.amount > payable.pending) {
    throw new ConflictError('Abono exceeds pending amount');
  }

  const abonoId = ids.generate();
  const movementId = ids.generate();
  const now = new Date();

  await payableRepo.addAbono(userId, payableId, {
    id: abonoId,
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    movementId,
  });

  // Atomicity note: abono push + movement creation are two separate writes
  // inside this single use-case invocation. Full transactionality would
  // require the repository ports to accept a Mongoose ClientSession — an
  // infrastructure change deliberately out of scope here.

  // Create expense movement (abono = payment from account)
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: input.accountId,
    category: payableCategory('expense'),
    type: 'expense',
    amount: new Money(input.amount, input.currency),
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    context: 'Personal',
    link: { kind: 'payableAbono', refId: payableId, opId: ids.generate() },
    createdAt: now,
  });
  await movementRepo.create(movement);

  // Return updated payable with new abono appended
  const abono = {
    id: abonoId,
    amount: new Money(input.amount, input.currency),
    date: input.date,
    accountId: input.accountId,
    movementId,
  };
  return new Payable(
    {
      id: payable.id,
      userId: payable.userId,
      counterparty: payable.counterparty,
      total: payable.total,
      initialPayment: payable.initialPayment,
      accountId: payable.accountId,
      date: payable.date,
      dueDate: payable.dueDate,
      note: payable.note,
      createdAt: payable.createdAt,
    },
    [...payable.abonos, abono],
  );
}
