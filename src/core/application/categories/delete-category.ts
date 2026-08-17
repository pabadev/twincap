import type { CategoryRepository, MovementRepository } from '../../domain/repositories';
import { NotFoundError, ConflictError } from '../../domain/errors';

export async function deleteCategory(
  userId: string,
  categoryId: string,
  categoryRepo: CategoryRepository,
  movementRepo: MovementRepository,
): Promise<void> {
  const category = await categoryRepo.findById(userId, categoryId);
  if (!category) throw new NotFoundError('Category not found');

  // CAT-3: deletion guard — reject while referenced by any movement
  const movementCount = await movementRepo.countByCategoryId(userId, categoryId);
  if (movementCount > 0) {
    throw new ConflictError('Category has movements and cannot be deleted');
  }

  await categoryRepo.delete(userId, categoryId);
}
