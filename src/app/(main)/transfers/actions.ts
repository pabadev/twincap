'use server';

import {
  createTransfer,
  updateTransfer,
  deleteTransfer,
} from '../../../core/application/transfers';
import type { CreateTransferInput, UpdateTransferInput } from '../../../core/application/transfers';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { objectIdGenerator } from '../../../infrastructure/config/id-generator';
import { revalidatePath } from 'next/cache';
import { assertBusinessDateNotFuture } from '../../../lib/date';
import { handleActionError } from '../../../lib/handle-action-error';

const ids = objectIdGenerator;

export async function createTransferAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const sourceAccountId = formData.get('sourceAccountId') as string;
  const destinationAccountId = formData.get('destinationAccountId') as string;
  const sourceAmount = Number(formData.get('sourceAmount') || '0');
  const sourceCurrency = formData.get('sourceCurrency') as CreateTransferInput['sourceCurrency'];
  const destinationAmount = Number(formData.get('destinationAmount') || '0') || undefined;
  const destinationCurrency = (formData.get('destinationCurrency') as CreateTransferInput['destinationCurrency']) || undefined;
  const rate = Number(formData.get('rate') || '0') || undefined;
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const note = (formData.get('note') as string) || undefined;

  const input: CreateTransferInput = {
    sourceAccountId,
    destinationAccountId,
    sourceAmount,
    sourceCurrency,
    destinationAmount,
    destinationCurrency,
    rate,
    date,
    note,
  };

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const transferRepo = new MongoTransferRepository();
    const movementRepo = new MongoMovementRepository();
    const accountRepo = new MongoAccountRepository();
    await createTransfer(
      user.userId,
      input,
      transferRepo,
      movementRepo,
      ids,
      accountRepo,
    );
    revalidatePath('/transfers');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'transferCreated' };
}

export async function updateTransferAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const transferId = formData.get('transferId') as string;
  const sourceAmount = Number(formData.get('sourceAmount') || '0');
  const destinationAmount = Number(formData.get('destinationAmount') || '0') || undefined;
  const rate = Number(formData.get('rate') || '0') || undefined;
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const note = (formData.get('note') as string) || undefined;

  const input: UpdateTransferInput = {
    sourceAmount,
    destinationAmount,
    rate,
    date,
    note,
  };

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const transferRepo = new MongoTransferRepository();
    const movementRepo = new MongoMovementRepository();
    await updateTransfer(
      user.userId,
      transferId,
      input,
      transferRepo,
      movementRepo,
    );
    revalidatePath('/transfers');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'transferUpdated' };
}

export async function deleteTransferAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const transferId = formData.get('transferId') as string;

  try {
    await connectDb();
    const transferRepo = new MongoTransferRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteTransfer(user.userId, transferId, transferRepo, movementRepo);
    revalidatePath('/transfers');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'transferDeleted' };
}
