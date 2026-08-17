import { Category } from '../../domain/category';
import type { CategoryRepository } from '../../domain/repositories';
import { NotFoundError, ConflictError } from '../../domain/errors';

export interface UpdateCategoryInput {
  categoryId: string;
  name: string;
}

export async function updateCategory(
  userId: string,
  input: UpdateCategoryInput,
  categoryRepo: CategoryRepository,
): Promise<Category> {
  const category = await categoryRepo.findById(userId, input.categoryId);
  if (!category) throw new NotFoundError('Category not found');

  // CAT-2: type immutable — only name can change
  // Check uniqueness if name changed
  if (input.name.trim() !== category.name) {
    const existing = await categoryRepo.findByNameAndType(
      userId,
      input.name.trim(),
      category.type,
    );
    if (existing) {
      throw new ConflictError('Category name already exists for this type');
    }
  }

  const updated = new Category({
    id: category.id,
    userId: category.userId,
    name: input.name.trim(),
    type: category.type,
    createdAt: category.createdAt,
  });
  await categoryRepo.update(updated);
  return updated;
}
