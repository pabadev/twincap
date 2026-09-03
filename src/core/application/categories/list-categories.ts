import type { Category } from '../../domain/category';
import type { CategoryRepository } from '../../domain/repositories';

export async function listCategories(
  workspaceId: string,
  categoryRepo: CategoryRepository,
): Promise<Category[]> {
  return categoryRepo.findByWorkspaceId(workspaceId);
}
