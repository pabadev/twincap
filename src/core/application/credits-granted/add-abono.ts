import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError, ConflictError } from '../../domain/errors';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { AddAbonoInput } from './dto/credits-granted';

/**
 * Add an abono to a credit granted (CRED-G-2, CRED-G-3).
 *
 * Pending = principal − Σ abonos. Overpayment is rejected.
 * Produces a linked income movement (debtor pays back).
 * D3: the movement inherits the receiving account's scope (the abono may be
 * collected into a different account than the credit's own account).
 */
export async function addAbono(
  userId: string,
  creditId: string,
  input: AddAbonoInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<CreditGranted> {
  // Re-fetch via repo — returns CreditGranted instance with pending getter
  const credits = await creditRepo.findByUserId(userId);
  const credit = credits.find(c => c.id === creditId);
  if (!credit) throw new NotFoundError('Credit not found');

  // D3: resolve the RECEIVING account (may differ from the credit's account) —
  // validates existence/ownership and provides the inherited scope.
  const account = await accountRepo.findById(userId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  // CRED-G-2: pending = principal − Σ abonos; overpayment rejected
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

  // Create income movement (abono = debtor pays back → income on receiving account)
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: input.accountId,
    category: creditGrantedCategory('income'),
    type: 'income',
    amount: new Money(input.amount, input.currency),
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    context: account.scope,
    link: { kind: 'creditGrantedAbono', refId: creditId, opId: ids.generate() },
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
  return new CreditGranted(
    {
      id: credit.id,
      userId: credit.userId,
      counterparty: credit.counterparty,
      principal: credit.principal,
      accountId: credit.accountId,
      date: credit.date,
      installments: credit.installments,
      frequency: credit.frequency,
      saleId: credit.saleId,
      createdAt: credit.createdAt,
    },
    [...credit.abonos, abono],
  );
}
