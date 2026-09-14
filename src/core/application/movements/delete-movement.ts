import type { MovementRepository, AccountRepository } from '../../domain/repositories';
import { NotFoundError, ValidationError } from '../../domain/errors';
import type { UnitOfWork } from '../ports';
import { touchAccount } from '../financial/touch-accounts';

/**
 * Delete a manual movement.
 *
 * R15.3.2 Fase 4: the whole deletion runs INSIDE a single multi-document
 * transaction — the movement delete and the account touch commit or roll back
 * atomically:
 * - deleting a movement changes the account's derived balance, so the account
 *   doc must be touched as the LAST write (shared-document conflict point,
 *   R15.1-6e): a balance-calculation read racing the delete conflicts here
 *   instead of reading a stale projection, and the whole operation aborts
 *   atomically if anything fails (no orphaned balance state).
 * - `findById` stays session-less by documented convention (cheap existence
 *   source for the mutation target; the account touch is the conflict point).
 * - the movement's `accountId` is captured from the read BEFORE the delete —
 *   it is the only source of truth for which account to touch.
 */
export async function deleteMovement(
  userId: string,
  movementId: string,
  movementRepo: MovementRepository,
  accountRepo: AccountRepository,
  uow: UnitOfWork,
): Promise<void> {
  return uow.withTransaction(async (tx) => {
    const movement = await movementRepo.findById(userId, movementId);
    if (!movement) throw new NotFoundError('Movement not found');

    // MOV-5: system-linked movements cannot be deleted directly
    if (movement.link) {
      throw new ValidationError('System-linked movements cannot be deleted directly');
    }

    await movementRepo.delete(userId, movementId, tx);
    await touchAccount(accountRepo, userId, movement.accountId, tx);
  });
}