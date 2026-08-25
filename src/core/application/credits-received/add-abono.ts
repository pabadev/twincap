import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { AddAbonoInput } from './dto/credits-received';

/**
 * Add an abono to a credit received (CRED-R-2, CRED-R-3).
 *
 * Pending = principal − Σ abonos. Overpayment is rejected.
 * Produces a linked expense movement (payment from account).
 * D3: the movement inherits the payment account's scope (the abono may be
 * paid from a different account than the credit's own account).
 */
export async function addAbono(
  userId: string,
  creditId: string,
  input: AddAbonoInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<CreditReceived> {
  // Re-fetch via repo — returns CreditReceived instance with pending getter
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // D3: resolve the PAYMENT account (may differ from the credit's account) —
  // validates existence/ownership and provides the inherited scope.
  const account = await accountRepo.findById(userId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // CRED-R-2: pending = principal − Σ abonos; overpayment rejected
  if (input.amount > credit.pending) {
    throw new ConflictError('Abono exceeds pending amount');
  }

  const abonoId = ids.generate();
  const movementId = ids.generate();
  const now = new Date();

  await creditRepo.addAbono(userId, creditId, {
    id: abonoId,
    amount: input.amount,
    date: input.date,
    accountId: input.accountId,
    movementId,
  });

  // Create expense movement (abono = payment from account)
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: input.accountId,
    category: creditCategory('expense'),
    type: 'expense',
    amount: new Money(input.amount, input.currency),
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    context: account.scope,
    link: { kind: 'creditReceivedAbono', refId: creditId, opId: ids.generate() },
    createdAt: now,
  });
  await movementRepo.create(movement);

  // Return updated credit with new abono appended
  const abono = {
    id: abonoId,
    amount: new Money(input.amount, input.currency),
    date: input.date,
    accountId: input.accountId,
    movementId,
  };
  return new CreditReceived(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: credit.principal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      frequency: credit.frequency,
      createdAt: credit.createdAt,
    },
    [...credit.abonos, abono],
  );
}
