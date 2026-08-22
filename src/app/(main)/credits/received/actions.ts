'use server';

import {
  createCreditReceived,
  addAbono,
  editAbono,
  deleteAbono,
  editPrincipal,
  deleteCreditReceived,
} from '../../../../core/application/credits-received';
import type { Currency } from '../../../../core/domain/currency';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCreditReceivedRepository } from '../../../../infrastructure/repositories/credit-received-repository';
import { MongoMovementRepository } from '../../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../../lib/handle-action-error';

const ids = { generate: () => crypto.randomUUID() };

export async function createCreditReceivedAction(
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
    const creditRepo = new MongoCreditReceivedRepository();
    const movementRepo = new MongoMovementRepository();
    await createCreditReceived(
      user.userId,
      { counterparty, principal, currency, accountId, date, installments, frequency },
      creditRepo,
      movementRepo,
      ids,
    );
    revalidatePath('/credits/received');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
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
    const creditRepo = new MongoCreditReceivedRepository();
    const movementRepo = new MongoMovementRepository();
    await addAbono(
      user.userId,
      creditId,
      { amount, currency, accountId, date },
      creditRepo,
      movementRepo,
      ids,
    );
    revalidatePath('/credits/received');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'abonoAdded' };
}

export async function editAbonoAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const creditId = formData.get('creditId') as string;
  const abonoId = formData.get('abonoId') as string;
  const amount = Number(formData.get('amount') || '0');
  const date = new Date(formData.get('date') as string);

  try {
    await connectDb();
    const creditRepo = new MongoCreditReceivedRepository();
    const movementRepo = new MongoMovementRepository();
    await editAbono(
      user.userId,
      creditId,
      abonoId,
      { amount, date },
      creditRepo,
      movementRepo,
    );
    revalidatePath('/credits/received');
    revalidatePath('/accounts');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'abonoUpdated' };
}

export async function editCreditReceivedAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const creditId = formData.get('creditId') as string;
  const principal = Number(formData.get('principal') || '0');
  const currency = formData.get('currency') as Currency;

  try {
    await connectDb();
    const creditRepo = new MongoCreditReceivedRepository();
    const movementRepo = new MongoMovementRepository();
    await editPrincipal(
      user.userId,
      creditId,
      { principal, currency },
      creditRepo,
      movementRepo,
    );
    revalidatePath('/credits/received');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'creditUpdated' };
}

export async function deleteAbonoAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const creditId = formData.get('creditId') as string;
  const abonoId = formData.get('abonoId') as string;

  try {
    await connectDb();
    const creditRepo = new MongoCreditReceivedRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteAbono(user.userId, creditId, abonoId, creditRepo, movementRepo);
    revalidatePath('/credits/received');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'abonoDeleted' };
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
    const creditRepo = new MongoCreditReceivedRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteCreditReceived(user.userId, creditId, creditRepo, movementRepo);
    revalidatePath('/credits/received');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'creditDeleted' };
}
