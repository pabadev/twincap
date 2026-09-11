import type { CategoryRepository, MovementRepository } from '../../domain/repositories';
import type { UnitOfWork } from '../ports';
import { NotFoundError, ConflictError } from '../../domain/errors';

/**
 * Delete a category.
 *
 * R15.3 §9: transactional. The read, the reference guard and the delete run
 * inside ONE transaction, and the delete is the LAST write — the category doc
 * is the shared-document conflict point that createMovement/updateMovement
 * touch: a movement write that commits between the guard and the delete aborts
 * THIS transaction (write-write conflict on the category doc) and the retry
 * re-counts references → ConflictError. Without the transaction, a concurrent
 * createMovement could insert a Movement referencing a deleted category.
 */
export async function deleteCategory(
  userId: string,
  categoryId: string,
  categoryRepo: CategoryRepository,
  movementRepo: MovementRepository,
  uow: UnitOfWork,
): Promise<void> {
  return uow.withTransaction(async (tx) => {
    const category = await categoryRepo.findById(userId, categoryId, tx);
    if (!category) throw new NotFoundError('Category not found');

    // CAT-3: deletion guard — reject while referenced by any movement. The
    // count joins the transaction session (serial on the session — the driver
    // forbids concurrent ops on one ClientSession).
    const movementCount = await movementRepo.countByCategoryId(userId, categoryId, tx);
    if (movementCount > 0) {
      throw new ConflictError('Category has movements and cannot be deleted');
    }

    // LAST write of the transaction: the shared-document conflict point.
    await categoryRepo.delete(userId, categoryId, tx);
  });
}