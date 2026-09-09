import { Payable } from '../../domain/payable';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError, ValidationError } from '../../domain/errors';
import { payableCategory } from '../../domain/synthetic-categories';
import type { PayableRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';
import type { AddAbonoInput } from './dto/payables';

/**
 * Add an abono (payment) to a payable (PAY-R-2).
 *
 * Pending = total − initialPayment − Σ abonos. Overpayment is rejected.
 * Produces exactly ONE linked expense movement (kind 'payableAbono').
 * Movement context: always 'Personal' — payable abonos are personal purchases.
 *
 * R15 Fase 3: the aggregate read AND the balance/currency validations that
 * derive from it run INSIDE the transaction (snapshot-consistent), and the two
 * writes (abono $push + movement create) commit or roll back atomically. The
 * payment-account validation stays OUTSIDE the tx — AccountRepository has no
 * transaction handle (static reference resolved up front; matrix row 70).
 */
export async function addAbono(
  workspaceId: string,
  payableId: string,
  input: AddAbonoInput,
  payableRepo: PayableRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<Payable> {
  // D3: resolve the PAYMENT account (may differ from the payable's account) —
  // validates existence/ownership.
  const account = await accountRepo.findById(workspaceId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // ACC-1: the PAYMENT account's currency must match the abono's currency —
  // otherwise the movement would be re-labeled in the account currency on read.
  if (account.currency !== input.currency) {
    throw new ValidationError(
      `Payment account currency is ${account.currency}, abono is ${input.currency}`,
    );
  }

  return uow.withTransaction(async (tx) => {
    // Re-fetch via repo — returns Payable instance with pending getter.
    // The read joins the transaction session (Fase 3) so the aggregate is
    // snapshot-consistent with the writes that follow.
    const payables = await payableRepo.findByWorkspaceId(workspaceId, tx);
    const payable = payables.find(p => p.id === payableId);
    if (!payable) throw new NotFoundError('Payable not found');

    // ACC-1: the abono's currency must match the payable's total currency.
    if (input.currency !== payable.total.currency) {
      throw new ValidationError(`Payable currency is ${payable.total.currency}, declared ${input.currency}`);
    }

    // PAY-R-2: pending = total − initialPayment − Σ abonos; overpayment rejected
    if (input.amount > payable.pending) {
      throw new ConflictError('Abono exceeds pending amount');
    }

    const abonoId = ids.generate();
    const movementId = ids.generate();
    const now = new Date();

    await payableRepo.addAbono(workspaceId, payableId, {
      id: abonoId,
      amount: input.amount,
      date: input.date,
      accountId: input.accountId,
      movementId,
    }, tx, payable.version);

    // Create expense movement (abono = payment from account)
    const movement = new Movement({
      id: movementId,
      workspaceId,
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
    await movementRepo.create(movement, tx);

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
      [...payable.abonos, abono],
    );
  });
}