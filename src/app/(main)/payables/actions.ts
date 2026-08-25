'use server';

import {
  createPayable,
  addAbono,
  editAbono,
  deleteAbono,
  editTotal,
  deletePayable,
} from '../../../core/application/payables';
import type { Currency } from '../../../core/domain/currency';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoPayableRepository } from '../../../infrastructure/repositories/payable-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../lib/handle-action-error';

const ids = { generate: () => crypto.randomUUID() };

export async function createPayableAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const counterparty = formData.get('counterparty') as string;
  const total = Number(formData.get('total') || '0');
  const initialPayment = Number(formData.get('initialPayment') || '0');
  const currency = formData.get('currency') as Currency;
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);
  const dueDateRaw = formData.get('dueDate') as string;
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : undefined;
  const note = ((formData.get('note') as string) || '').trim() || undefined;

  try {
    await connectDb();
    const payableRepo = new MongoPayableRepository();
    const movementRepo = new MongoMovementRepository();
    const accountRepo = new MongoAccountRepository();
    await createPayable(
      user.userId,
      { counterparty, total, initialPayment, currency, accountId, date, dueDate, note },
      payableRepo,
      movementRepo,
      ids,
      accountRepo,
    );
    revalidatePath('/payables');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'payableCreated' };
}

export async function addAbonoAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const payableId = formData.get('payableId') as string;
  const amount = Number(formData.get('amount') || '0');
  const currency = formData.get('currency') as Currency;
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);

  try {
    await connectDb();
    const payableRepo = new MongoPayableRepository();
    const movementRepo = new MongoMovementRepository();
    const accountRepo = new MongoAccountRepository();
    await addAbono(
      user.userId,
      payableId,
      { amount, currency, accountId, date },
      payableRepo,
      movementRepo,
      ids,
      accountRepo,
    );
    revalidatePath('/payables');
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

  const payableId = formData.get('payableId') as string;
  const abonoId = formData.get('abonoId') as string;
  const amount = Number(formData.get('amount') || '0');
  const date = new Date(formData.get('date') as string);

  try {
    await connectDb();
    const payableRepo = new MongoPayableRepository();
    const movementRepo = new MongoMovementRepository();
    await editAbono(
      user.userId,
      payableId,
      abonoId,
      { amount, date },
      payableRepo,
      movementRepo,
    );
    revalidatePath('/payables');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'abonoUpdated' };
}

export async function editPayableAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const payableId = formData.get('payableId') as string;
  const total = Number(formData.get('total') || '0');
  const currency = formData.get('currency') as Currency;

  try {
    await connectDb();
    const payableRepo = new MongoPayableRepository();
    await editTotal(
      user.userId,
      payableId,
      { total, currency },
      payableRepo,
    );
    revalidatePath('/payables');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'payableUpdated' };
}

export async function deleteAbonoAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const payableId = formData.get('payableId') as string;
  const abonoId = formData.get('abonoId') as string;

  try {
    await connectDb();
    const payableRepo = new MongoPayableRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteAbono(user.userId, payableId, abonoId, payableRepo, movementRepo);
    revalidatePath('/payables');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'abonoDeleted' };
}

export async function deletePayableAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const payableId = formData.get('payableId') as string;

  try {
    await connectDb();
    const payableRepo = new MongoPayableRepository();
    const movementRepo = new MongoMovementRepository();
    await deletePayable(user.userId, payableId, payableRepo, movementRepo);
    revalidatePath('/payables');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'payableDeleted' };
}
