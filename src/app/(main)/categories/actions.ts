'use server';

import {
  createCategory,
  deleteCategory,
} from '../../../core/application/categories';
import type { CreateCategoryInput } from '../../../core/application/categories';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { objectIdGenerator } from '../../../infrastructure/config/id-generator';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../lib/handle-action-error';

const ids = objectIdGenerator;

export async function createCategoryAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const type = formData.get('type') as CreateCategoryInput['type'];

  try {
    await connectDb();
    const categoryRepo = new MongoCategoryRepository();
    await createCategory(
      user.userId,
      { name, type },
      categoryRepo,
      ids,
    );
    revalidatePath('/categories');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'categoryCreated' };
}

export async function deleteCategoryAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const categoryId = formData.get('categoryId') as string;

  try {
    await connectDb();
    const categoryRepo = new MongoCategoryRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteCategory(user.userId, categoryId, categoryRepo, movementRepo);
    revalidatePath('/categories');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'categoryDeleted' };
}
