'use server';

import { redirect } from 'next/navigation';
import {
  createCategory,
  deleteCategory,
} from '../../../core/application/categories';
import type { CreateCategoryInput } from '../../../core/application/categories';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';

const categoryRepo = new MongoCategoryRepository();
const movementRepo = new MongoMovementRepository();
const ids = { generate: () => crypto.randomUUID() };

export async function createCategoryAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const name = formData.get('name') as string;
  const type = formData.get('type') as CreateCategoryInput['type'];

  try {
    await createCategory(
      user.userId,
      { name, type },
      categoryRepo,
      ids,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to create category',
    };
  }

  redirect('/categories');
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const categoryId = formData.get('categoryId') as string;

  try {
    await deleteCategory(user.userId, categoryId, categoryRepo, movementRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    // Silently ignore delete errors — user sees no change
  }

  redirect('/categories');
}
