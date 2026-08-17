'use server';

import { redirect } from 'next/navigation';
import {
  createTransfer,
  deleteTransfer,
} from '../../../core/application/transfers';
import type { CreateTransferInput } from '../../../core/application/transfers';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';

const transferRepo = new MongoTransferRepository();
const movementRepo = new MongoMovementRepository();
const ids = { generate: () => crypto.randomUUID() };

export async function createTransferAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const sourceAccountId = formData.get('sourceAccountId') as string;
  const destinationAccountId = formData.get('destinationAccountId') as string;
  const sourceAmount = Number(formData.get('sourceAmount') || '0');
  const sourceCurrency = formData.get('sourceCurrency') as CreateTransferInput['sourceCurrency'];
  const destinationAmount = Number(formData.get('destinationAmount') || '0') || undefined;
  const destinationCurrency = (formData.get('destinationCurrency') as CreateTransferInput['destinationCurrency']) || undefined;
  const rate = Number(formData.get('rate') || '0') || undefined;
  const date = new Date(formData.get('date') as string);
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
    await createTransfer(
      user.userId,
      input,
      transferRepo,
      movementRepo,
      ids,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to create transfer',
    };
  }

  redirect('/transfers');
}

export async function deleteTransferAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const transferId = formData.get('transferId') as string;

  try {
    await deleteTransfer(user.userId, transferId, transferRepo, movementRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
  }

  redirect('/transfers');
}
