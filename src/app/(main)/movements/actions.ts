'use server';

import {
  createMovement,
  deleteMovement,
} from '../../../core/application/movements';
import type { CreateMovementInput } from '../../../core/application/movements';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { handleActionError } from '../../../lib/handle-action-error';

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
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'movementCreated' };
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
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'movementDeleted' };
}
