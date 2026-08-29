import type { AccountRepository, MovementRepository } from '../../domain/repositories';
import { NotFoundError, ValidationError, ConflictError } from '../../domain/errors';

export async function deleteAccount(
  userId: string,
  accountId: string,
  accountRepo: AccountRepository,
  movementRepo: MovementRepository,
): Promise<void> {
  const account = await accountRepo.findById(userId, accountId);
  if (!account) throw new NotFoundError('Account not found');

  // ACC-1: fixed accounts cannot be deleted
  if (account.isFixed) {
    throw new ValidationError('Fixed accounts cannot be deleted');
  }

  // ACC-4: deletion guard — reject while referenced by any collection.
  // Opening movements are NOT references: they are intrinsic to the account
  // (created when the account is opened with an initial balance), so they are
  // removed in cascade below instead of blocking deletion.
  const referenceCount = await accountRepo.countReferences(userId, accountId);
  if (referenceCount > 0) {
    throw new ConflictError('Account has references and cannot be deleted');
  }

  // Cascade: delete the account's opening movements (its intrinsic balance
  // seed). Tolerant to already-missing openings (race → not an error).
  const accountMovements = await movementRepo.findByAccountId(userId, accountId);
  const openings = accountMovements.filter((m) => m.link?.kind === 'opening');
  for (const movement of openings) {
    try {
      await movementRepo.delete(userId, movement.id);
    } catch (err) {
      if (err instanceof NotFoundError) continue;
      throw err;
    }
  }

  await accountRepo.delete(userId, accountId);
}
