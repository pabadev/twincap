'use server';

import { redirect } from 'next/navigation';
import {
  createAccount,
  deleteAccount,
} from '../../../core/application/accounts';
import type { CreateAccountInput } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';

const accountRepo = new MongoAccountRepository();
const movementRepo = new MongoMovementRepository();
const ids = { generate: () => crypto.randomUUID() };

export async function createAccountAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const name = formData.get('name') as string;
  const currency = formData.get('currency') as CreateAccountInput['currency'];
  const initialBalance = Number(formData.get('initialBalance') || '0');

  try {
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

  redirect('/accounts');
}

export async function deleteAccountAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const accountId = formData.get('accountId') as string;

  try {
    await deleteAccount(user.userId, accountId, accountRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    // Silently ignore delete errors — user sees no change
  }

  redirect('/accounts');
}
