'use server';

import {
  createAccount,
  deleteAccount,
} from '../../../core/application/accounts';
import type { CreateAccountInput } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../infrastructure/db/connection';

const ids = { generate: () => crypto.randomUUID() };

export async function createAccountAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const currency = formData.get('currency') as CreateAccountInput['currency'];
  const initialBalance = Number(formData.get('initialBalance') || '0');

  try {
    await connectDb();
    const accountRepo = new MongoAccountRepository();
    const movementRepo = new MongoMovementRepository();
    await createAccount(
      user.userId,
      { name, currency, initialBalance },
      accountRepo,
      movementRepo,
      ids,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to create account',
    };
  }

  return { success: 'accountCreated' };
}

export async function deleteAccountAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const accountId = formData.get('accountId') as string;

  try {
    await connectDb();
    const accountRepo = new MongoAccountRepository();
    await deleteAccount(user.userId, accountId, accountRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to delete account',
    };
  }

  return { success: 'accountDeleted' };
}
