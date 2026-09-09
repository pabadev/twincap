import { Account } from '../../domain/account';
import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { openingCategory } from '../../domain/synthetic-categories';
import type { AccountRepository, MovementRepository } from '../../domain/repositories';
import type { Currency } from '../../domain/currency';
import type { IdGenerator, UnitOfWork } from '../ports';

export interface CreateAccountInput {
  name: string;
  currency: Currency;
  initialBalance: number; // 0 = no opening movement
}

/**
 * Create an account and, when it has a positive initial balance, its opening
 * movement — as ONE atomic unit.
 *
 * R15 Fase 6 (§11): the account create and the opening movement create run
 * inside `uow.withTransaction(...)`. A failure in either write aborts BOTH via
 * real rollback, replacing the old R8 manual compensation (`try/catch` →
 * `accountRepo.delete`) that left a window where a partial state could exist.
 * The ids are minted INSIDE the callback so a driver retry never opens a second
 * account (no duplicate ids across retries).
 */
export async function createAccount(
  workspaceId: string,
  input: CreateAccountInput,
  accountRepo: AccountRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  uow: UnitOfWork,
): Promise<Account> {
  return uow.withTransaction(async (tx) => {
    // ACC-2: currency set at creation, immutable
    const accountId = ids.generate();
    const account = new Account({
      id: accountId,
      workspaceId,
      name: input.name.trim(),
      currency: input.currency,
      isFixed: false,
      createdAt: new Date(),
    });
    await accountRepo.create(account, tx);

    // ACC-3: opening movement if initialBalance > 0 — default to Personal.
    if (input.initialBalance > 0) {
      const movement = new Movement({
        id: ids.generate(),
        workspaceId,
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
      await movementRepo.create(movement, tx);
    }

    return account;
  });
}
