'use server';

import {
  createAccount,
  deleteAccount,
} from '../../../core/application/accounts';
import type { CreateAccountInput } from '../../../core/application/accounts';
import { isAccountScope } from '../../../core/domain/account';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../lib/handle-action-error';

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
  const scopeRaw = formData.get('scope');
  // D3: validate server-side; absent value falls through to the domain default.
  let scope: CreateAccountInput['scope'];
  if (typeof scopeRaw === 'string' && scopeRaw.length > 0) {
    if (!isAccountScope(scopeRaw)) {
      return { error: 'error.validation' };
    }
    scope = scopeRaw;
  }

  try {
    await connectDb();
    const accountRepo = new MongoAccountRepository();
    const movementRepo = new MongoMovementRepository();
    await createAccount(
      user.userId,
      { name, currency, initialBalance, scope },
      accountRepo,
      movementRepo,
      ids,
    );
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
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
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
    revalidatePath('/transfers');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'accountDeleted' };
}
