import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { NotFoundError } from '../../domain/errors';
import { creditCategory } from '../../domain/synthetic-categories';
import type { CreditReceivedRepository, MovementRepository, AccountRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateCreditReceivedInput } from './dto/credits-received';

/**
 * Create a credit received (CRED-R-1).
 *
 * Produces a credit record and one linked income movement on the receiving account.
 * The movement is system-linked (MOV-5) and not directly editable by the user.
 * Movement context: always 'Personal' — credits received are personal financing.
 */
export async function createCreditReceived(
  userId: string,
  input: CreateCreditReceivedInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  accountRepo: AccountRepository,
): Promise<CreditReceived> {
  // D3: resolve the receiving account — validates existence/ownership.
  const account = await accountRepo.findById(userId, input.accountId);
  if (!account) {
    throw new NotFoundError(`Account ${input.accountId} not found`);
  }

  const creditId = ids.generate();
  const principalMoney = new Money(input.principal, input.currency);
  const now = new Date();

  const credit = new CreditReceived({
    id: creditId,
    userId,
    counterparty: input.counterparty,
    principal: principalMoney,
    accountId: input.accountId,
    date: input.date,
    installments: input.installments,
    frequency: input.frequency,
    createdAt: now,
  });

  await creditRepo.create(credit);

  // Create principal movement (income on receiving account)
  const movementId = ids.generate();
  const opId = ids.generate();
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: input.accountId,
    category: creditCategory('income'),
    type: 'income',
    amount: principalMoney,
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    context: 'Personal',
    link: { kind: 'creditReceivedPrincipal', refId: creditId, opId },
    createdAt: now,
  });
  await movementRepo.create(movement);

  return credit;
}
