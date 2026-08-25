import { CreditGranted } from '../../domain/credit-granted';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { creditGrantedCategory } from '../../domain/synthetic-categories';
import type { CreditGrantedRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateCreditGrantedInput } from './dto/credits-granted';

/**
 * Create a credit granted (CRED-G-1).
 *
 * Produces a credit record and one linked expense movement on the paying account.
 * The movement is system-linked (MOV-5) and not directly editable by the user.
 */
export async function createCreditGranted(
  userId: string,
  input: CreateCreditGrantedInput,
  creditRepo: CreditGrantedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<CreditGranted> {
  const creditId = ids.generate();
  const principalMoney = new Money(input.principal, input.currency);
  const now = new Date();

  const credit = new CreditGranted({
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

  // Create principal movement (expense on paying account — money goes out)
  const movementId = ids.generate();
  const opId = ids.generate();
  const movement = new Movement({
    id: movementId,
    userId,
    accountId: input.accountId,
    category: creditGrantedCategory('expense'),
    type: 'expense',
    amount: principalMoney,
    date: input.date,
    // No persisted note: display text derives at render from link.kind.
    context: 'Personal',
    link: { kind: 'creditGrantedPrincipal', refId: creditId, opId },
    createdAt: now,
  });
  await movementRepo.create(movement);

  return credit;
}
