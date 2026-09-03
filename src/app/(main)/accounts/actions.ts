'use server';

import {
  createAccount,
  updateAccount,
  deleteAccount,
  setInitialAccountBalance,
} from '../../../core/application/accounts';
import type { CreateAccountInput } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { claimIdempotency, releaseIdempotency } from '../../../infrastructure/auth/idempotency';
import { objectIdGenerator } from '../../../infrastructure/config/id-generator';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../lib/handle-action-error';
import { withAudit } from '../../../lib/with-audit';
import { MongoOperationLogger } from '../../../infrastructure/repositories/operation-log-repository';

const ids = objectIdGenerator;

export async function createAccountAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const currency = formData.get('currency') as CreateAccountInput['currency'];
  const initialBalance = Number(formData.get('initialBalance') || '0');
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'createAccount');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'createAccount',
        entityType: 'account',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'createAccount', entityType: 'account', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const accountRepo = new MongoAccountRepository();
        const movementRepo = new MongoMovementRepository();
        return createAccount(
          user.workspaceId!,
          { name, currency, initialBalance },
          accountRepo,
          movementRepo,
          ids,
        );
      },
    );
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'createAccount');
    return handleActionError(error);
  }

  return { success: 'accountCreated' };
}

export async function updateAccountAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const accountId = formData.get('accountId') as string;
  const name = formData.get('name') as string;

  try {
    await connectDb();
    const accountRepo = new MongoAccountRepository();
    await updateAccount(user.workspaceId!, { accountId, name }, accountRepo);
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
    revalidatePath('/transfers');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'accountUpdated' };
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
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteAccount', entityType: 'account', userId: user.userId },
      () => {
        const accountRepo = new MongoAccountRepository();
        const movementRepo = new MongoMovementRepository();
        return deleteAccount(user.workspaceId!, accountId, accountRepo, movementRepo);
      },
    );
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
    revalidatePath('/transfers');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'accountDeleted' };
}

export async function setInitialBalanceAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const accountId = formData.get('accountId') as string;
  const amount = Number(formData.get('amount') || '0');
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'setInitialBalance');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'setInitialBalance',
        entityType: 'account',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'setInitialBalance', entityType: 'account', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const accountRepo = new MongoAccountRepository();
        const movementRepo = new MongoMovementRepository();
        return setInitialAccountBalance(
          user.workspaceId!,
          { accountId, amount },
          accountRepo,
          movementRepo,
          ids,
        );
      },
    );
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'setInitialBalance');
    return handleActionError(error);
  }

  return { success: 'initialBalanceSet' };
}
