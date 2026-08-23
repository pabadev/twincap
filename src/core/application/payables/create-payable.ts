import { Payable } from '../../domain/payable';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { payableCategory } from '../../domain/synthetic-categories';
import type { PayableRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreatePayableInput } from './dto/payables';

/**
 * Create a payable — a purchase on credit (H10, Fase 8).
 *
 * Movement map (anti double-accounting): the purchase itself NEVER generates
 * a movement (goods arrived, no money left). Exactly ONE expense movement is
 * created when an initial payment accompanies the acquisition
 * (kind 'payableInitialPayment', refId = payable id).
 */
export async function createPayable(
  userId: string,
  input: CreatePayableInput,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<Payable> {
  const payableId = ids.generate();
  const totalMoney = new Money(input.total, input.currency);
  const now = new Date();

  // Entity construction validates total/initialPayment/counterparty BEFORE
  // any write happens.
  const payable = new Payable({
    id: payableId,
    userId,
    counterparty: input.counterparty,
    total: totalMoney,
    initialPayment: input.initialPayment ?? 0,
    accountId: input.accountId,
    date: input.date,
    dueDate: input.dueDate,
    note: input.note,
    createdAt: now,
  });

  await payableRepo.create(payable);

  if (payable.initialPayment > 0) {
    // Atomicity note: payable + linked movement are two separate writes inside
    // this single use-case invocation. Full transactionality would require the
    // repository ports to accept a Mongoose ClientSession (signature change
    // across every port/implementation) plus a replica-set connection — an
    // infrastructure change deliberately out of scope here.
    const movementId = ids.generate();
    const movement = new Movement({
      id: movementId,
      userId,
      accountId: input.accountId,
      category: payableCategory('expense'),
      type: 'expense',
      amount: new Money(payable.initialPayment, input.currency),
      date: input.date,
      note: `Initial payment for purchase from ${input.counterparty}`,
      context: 'Personal',
      link: { kind: 'payableInitialPayment', refId: payableId, opId: ids.generate() },
      createdAt: now,
    });
    await movementRepo.create(movement);
  }

  return payable;
}
