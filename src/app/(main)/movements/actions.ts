'use server';

import { redirect } from 'next/navigation';
import {
  createMovement,
  deleteMovement,
} from '../../../core/application/movements';
import type { CreateMovementInput } from '../../../core/application/movements';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { connectDb } from '../../../infrastructure/db/connection';

const ids = { generate: () => crypto.randomUUID() };

export async function createMovementAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to create movement',
    };
  }

  redirect('/movements');
}

export async function deleteMovementAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const movementId = formData.get('movementId') as string;

  try {
    await connectDb();
    const movementRepo = new MongoMovementRepository();
    await deleteMovement(user.userId, movementId, movementRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
  }

  redirect('/movements');
}
