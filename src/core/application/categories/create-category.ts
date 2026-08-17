import { Category } from '../../domain/category';
import type { CategoryType } from '../../domain/category';
import type { CategoryRepository } from '../../domain/repositories';
import { ConflictError } from '../../domain/errors';
import type { IdGenerator } from '../ports';

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
  categoryRepo: CategoryRepository,
  ids: IdGenerator,
): Promise<Category> {
  // CAT-2: name unique per user+type
  const existing = await categoryRepo.findByNameAndType(
    userId,
    input.name.trim(),
    input.type,
  );
  if (existing) {
    throw new ConflictError('Category name already exists for this type');
  }

  const category = new Category({
    id: ids.generate(),
    userId,
    name: input.name.trim(),
    type: input.type,
    createdAt: new Date(),
  });
  await categoryRepo.create(category);
  return category;
}
