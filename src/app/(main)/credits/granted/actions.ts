'use server';

import {
  createCreditGranted,
  addAbono,
  deleteCreditGranted,
} from '../../../../core/application/credits-granted';
import type { Currency } from '../../../../core/domain/currency';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCreditGrantedRepository } from '../../../../infrastructure/repositories/credit-granted-repository';
import { MongoMovementRepository } from '../../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../../infrastructure/db/connection';

const ids = { generate: () => crypto.randomUUID() };

export async function createCreditGrantedAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const counterparty = formData.get('counterparty') as string;
  const principal = Number(formData.get('principal') || '0');
  const currency = formData.get('currency') as Currency;
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);
  const installments = Number(formData.get('installments') || '0') || undefined;
  const frequency = (formData.get('frequency') as string) || undefined;

  try {
    await connectDb();
    const creditRepo = new MongoCreditGrantedRepository();
    const movementRepo = new MongoMovementRepository();
    await createCreditGranted(
      user.userId,
      { counterparty, principal, currency, accountId, date, installments, frequency },
      creditRepo,
      movementRepo,
      ids,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to create credit',
    };
  }

  return { success: 'creditCreated' };
}

export async function addAbonoAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const creditId = formData.get('creditId') as string;
  const amount = Number(formData.get('amount') || '0');
  const currency = formData.get('currency') as Currency;
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);

  try {
    await connectDb();
    const creditRepo = new MongoCreditGrantedRepository();
    const movementRepo = new MongoMovementRepository();
    await addAbono(
      user.userId,
      creditId,
      { amount, currency, accountId, date },
      creditRepo,
      movementRepo,
      ids,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to add abono',
    };
  }

  return { success: 'abonoAdded' };
}

export async function deleteCreditAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const creditId = formData.get('creditId') as string;

  try {
    await connectDb();
    const creditRepo = new MongoCreditGrantedRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteCreditGranted(user.userId, creditId, creditRepo, movementRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to delete credit',
    };
  }

  return { success: 'creditDeleted' };
}
