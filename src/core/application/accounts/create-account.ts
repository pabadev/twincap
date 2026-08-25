import { Account } from '../../domain/account';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { openingCategory } from '../../domain/synthetic-categories';
import type { AccountRepository, MovementRepository } from '../../domain/repositories';
import type { Currency } from '../../domain/currency';
import type { IdGenerator } from '../ports';

export interface CreateAccountInput {
  name: string;
  currency: Currency;
  initialBalance: number; // 0 = no opening movement
}

export async function createAccount(
  userId: string,
  input: CreateAccountInput,
  accountRepo: AccountRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
): Promise<Account> {
  // ACC-2: currency set at creation, immutable
  const accountId = ids.generate();
  const account = new Account({
    id: accountId,
    userId,
    name: input.name.trim(),
    currency: input.currency,
    isFixed: false,
    createdAt: new Date(),
  });
  await accountRepo.create(account);

  // ACC-3: opening movement if initialBalance > 0
  if (input.initialBalance > 0) {
    const movement = new Movement({
      id: ids.generate(),
      userId,
      accountId,
      category: openingCategory(),
      type: 'income',
      amount: new Money(input.initialBalance, input.currency),
      date: new Date(),
      // No persisted note: display text derives at render from link.kind.
      context: 'Personal',
      link: { kind: 'opening', refId: accountId, opId: ids.generate() },
      createdAt: new Date(),
    });
    await movementRepo.create(movement);
  }

  return account;
}
