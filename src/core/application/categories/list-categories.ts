import type { Category } from '../../domain/category';
import type { CategoryRepository } from '../../domain/repositories';

export async function listCategories(
  userId: string,
  categoryRepo: CategoryRepository,
): Promise<Category[]> {
  return categoryRepo.findByUserId(userId);
}
