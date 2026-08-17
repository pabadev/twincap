import { CreditReceived } from '../../domain/credit-received';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import type { CreditReceivedRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator } from '../ports';
import type { CreateCreditReceivedInput } from './dto/credits-received';

/**
 * Synthetic Category for credit-linked movements.
 * Credit movements are system-linked (MOV-5) and don't belong to user categories,
 * but the Movement constructor requires a Category object for MOV-2 validation.
 */
function creditCategory(id: string, type: 'income' | 'expense') {
  return { id, userId: '', name: 'Credit', type, createdAt: new Date() };
}

/**
 * Create a credit received (CRED-R-1).
 *
 * Produces a credit record and one linked income movement on the receiving account.
 * The movement is system-linked (MOV-5) and not directly editable by the user.
 */
export async function createCreditReceived(
  userId: string,
  input: CreateCreditReceivedInput,
  creditRepo: CreditReceivedRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<CreditReceived> {
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
    category: creditCategory(movementId, 'income'),
    type: 'income',
    amount: principalMoney,
    date: input.date,
    note: `Credit received from ${input.counterparty}`,
    context: 'Personal',
    link: { kind: 'creditReceivedPrincipal', refId: creditId, opId },
    createdAt: now,
  });
  await movementRepo.create(movement);

  return credit;
}
