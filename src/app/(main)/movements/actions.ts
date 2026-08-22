'use server';

import {
  createMovement,
  deleteMovement,
} from '../../../core/application/movements';
import type { CreateMovementInput } from '../../../core/application/movements';
import { listAccounts } from '../../../core/application/accounts';
import { listCategories } from '../../../core/application/categories';
import type { SerializedAccount } from '../../../core/domain/account';
import type { SerializedCategory } from '../../../core/domain/category';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../lib/handle-action-error';
import { serializeEntities } from '../../../lib/serialize';

const ids = { generate: () => crypto.randomUUID() };

export async function createMovementAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const accountId = formData.get('accountId') as string;
  const type = formData.get('type') as CreateMovementInput['type'];
  const amount = Number(formData.get('amount') || '0');
  const currency = formData.get('currency') as CreateMovementInput['currency'];
  const date = new Date(formData.get('date') as string);
  const note = (formData.get('note') as string) || undefined;
  const context = formData.get('context') as CreateMovementInput['context'];
  const categoryId = formData.get('categoryId') as string;

  try {
    await connectDb();
    const movementRepo = new MongoMovementRepository();
    const categoryRepo = new MongoCategoryRepository();
    await createMovement(
      user.userId,
      { accountId, type, amount, currency, date, note, context, categoryId },
      movementRepo,
      categoryRepo,
      ids,
    );
    revalidatePath('/movements');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'movementCreated' };
}

export async function listAccountsAction(): Promise<SerializedAccount[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const accounts = await listAccounts(user.userId, accountRepo);
  return serializeEntities(accounts);
}

export async function listCategoriesAction(): Promise<SerializedCategory[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  await connectDb();
  const categoryRepo = new MongoCategoryRepository();
  const categories = await listCategories(user.userId, categoryRepo);
  return serializeEntities(categories);
}

export async function deleteMovementAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const movementId = formData.get('movementId') as string;

  try {
    await connectDb();
    const movementRepo = new MongoMovementRepository();
    await deleteMovement(user.userId, movementId, movementRepo);
    revalidatePath('/movements');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'movementDeleted' };
}
