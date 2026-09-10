import type { AccountRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import { NotFoundError, ValidationError, ConflictError } from '../../domain/errors';

export async function deleteAccount(
  userId: string,
  accountId: string,
  accountRepo: AccountRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<void> {
  // R15.1-6e: the WHOLE operation runs inside one transaction. The guard
  // (account read + reference counts) and the cascade (opening-movement
  // deletes) execute on the SAME snapshot as the final account delete, so a
  // concurrent createMovement cannot slip a movement in between the reference
  // count and the delete. The account delete is the transaction's conflict
  // point: createMovement touches that same doc inside its own transaction,
  // so the race is a write-write conflict (one of them aborts and re-executes
  // on a fresh snapshot) instead of a write skew.
  return uow.withTransaction(async (tx) => {
    const account = await accountRepo.findById(userId, accountId, tx);
    if (!account) throw new NotFoundError('Account not found');

    // ACC-1: fixed accounts cannot be deleted
    if (account.isFixed) {
      throw new ValidationError('Fixed accounts cannot be deleted');
    }

    // ACC-4: deletion guard — reject while referenced by any collection.
    // Opening movements are NOT references: they are intrinsic to the account
    // (created when the account is opened with an initial balance), so they are
    // removed in cascade below instead of blocking deletion. The counts join
    // the transaction session, so the guard sees the same snapshot as the
    // account read above.
    const referenceCount = await accountRepo.countReferences(userId, accountId, tx);
    if (referenceCount > 0) {
      throw new ConflictError('Account has references and cannot be deleted');
    }

    // Cascade: delete the account's opening movements (its intrinsic balance
    // seed). Tolerant to already-missing openings (race → not an error).
    const accountMovements = await movementRepo.findByAccountId(userId, accountId, tx);
    const openings = accountMovements.filter((m) => m.link?.kind === 'opening');
    for (const movement of openings) {
      try {
        await movementRepo.delete(userId, movement.id, tx);
      } catch (err) {
        if (err instanceof NotFoundError) continue;
        throw err;
      }
    }

    // Last write: the account-doc delete. Any createMovement that touched this
    // doc before its insert conflicts here (write-write on the account) and
    // re-executes on the post-delete snapshot → NotFoundError.
    await accountRepo.delete(userId, accountId, tx);
  });
}