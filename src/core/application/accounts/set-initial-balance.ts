import { Movement } from '../../domain/movement';
import { Money } from '../../domain/money';
import { openingCategory } from '../../domain/synthetic-categories';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors';
import type { AccountRepository, MovementRepository } from '../../domain/repositories';
import type { IdGenerator, UnitOfWork } from '../ports';

export interface SetInitialBalanceInput {
  accountId: string;
  amount: number; // > 0
}

/**
 * Set an account's initial (opening) balance (ACC-2).
 *
 * Guards (in order): account exists/owned, amount > 0, account has NO existing
 * activity (countReferences === 0 — one opening movement per account).
 *
 * R15.2: the WHOLE flow runs inside `uow.withTransaction` — the account read,
 * the guards and the two writes (opening movement + shared-document touch on
 * the account, which doubles as the delete-race conflict point) commit or roll
 * back atomically. A concurrent deleteAccount that commits between the read
 * and the insert aborts THIS transaction (write-write conflict on the account
 * doc) and the retry re-reads the account as gone → NotFoundError; without the
 * touch the delete could commit in that window and leave the opening movement
 * orphaned (matrix row 41).
 */
export async function setInitialAccountBalance(
  workspaceId: string,
  input: SetInitialBalanceInput,
  accountRepo: AccountRepository,
  movementRepo: MovementRepository,
  ids: IdGenerator,
  uow: UnitOfWork,
): Promise<Movement> {
  if (input.amount <= 0) {
    throw new ValidationError('Initial balance must be greater than zero');
  }

  return uow.withTransaction(async (tx) => {
    const account = await accountRepo.findById(workspaceId, input.accountId, tx);
    if (!account) throw new NotFoundError('Account not found');

    // R15.2: shared-document write — touch the account inside this
    // transaction so a concurrent deleteAccount cannot commit between the
    // reference count and the opening insert (matrix row 41).
    const touched = await accountRepo.touch(workspaceId, input.accountId, tx);
    if (!touched) {
      throw new NotFoundError('Account not found');
    }

    const references = await accountRepo.countReferences(workspaceId, input.accountId, tx);
    if (references > 0) {
      throw new ConflictError('Account already has activity and cannot receive an initial balance');
    }

    const movement = new Movement({
      id: ids.generate(),
      workspaceId,
      accountId: input.accountId,
      category: openingCategory(),
      type: 'income',
      amount: new Money(input.amount, account.currency),
      date: new Date(),
      context: 'Personal',
      link: { kind: 'opening', refId: input.accountId, opId: ids.generate() },
      createdAt: new Date(),
    });
    await movementRepo.create(movement, tx);
    return movement;
  });
}