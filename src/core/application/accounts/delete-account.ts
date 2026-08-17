import type { AccountRepository } from '../../domain/repositories';
import { NotFoundError, ValidationError, ConflictError } from '../../domain/errors';

export async function deleteAccount(
  userId: string,
  accountId: string,
  accountRepo: AccountRepository,
): Promise<void> {
  const account = await accountRepo.findById(userId, accountId);
  if (!account) throw new NotFoundError('Account not found');

  // ACC-1: fixed accounts cannot be deleted
  if (account.isFixed) {
    throw new ValidationError('Fixed accounts cannot be deleted');
  }

  // ACC-4: deletion guard — reject while referenced by any collection
  const referenceCount = await accountRepo.countReferences(userId, accountId);
  if (referenceCount > 0) {
    throw new ConflictError('Account has references and cannot be deleted');
  }

  await accountRepo.delete(userId, accountId);
}
