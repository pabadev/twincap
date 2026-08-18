'use server';

import { redirect } from 'next/navigation';
import {
  createSale,
  addSaleAbono,
  editSaleAbono,
  deleteSaleAbono,
  deleteSale,
} from '../../../../core/application/sales';
import type { Currency } from '../../../../core/domain/currency';
import type { PaymentMode } from '../../../../core/domain/sale';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { MongoSaleRepository } from '../../../../infrastructure/repositories/sale-repository';
import { MongoMovementRepository } from '../../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../../infrastructure/db/connection';

const ids = { generate: () => crypto.randomUUID() };

export async function createSaleAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const lineItemsJson = formData.get('lineItems') as string;
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);
  const paymentMode = formData.get('paymentMode') as PaymentMode;
  const currency = formData.get('currency') as Currency;

  let items: { itemId: string; quantity: number; unitPrice: number }[];
  try {
    items = JSON.parse(lineItemsJson);
  } catch {
    return { error: 'Invalid line items data' };
  }

  if (!items || items.length === 0) {
    return { error: 'Sale must have at least one line item' };
  }

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
    const saleRepo = new MongoSaleRepository();
    const movementRepo = new MongoMovementRepository();
    await createSale(
      user.userId,
      { items, accountId, date, paymentMode, currency },
      saleRepo,
      catalogRepo,
      movementRepo,
      ids,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to create sale',
    };
  }

  redirect('/pos/sales');
}

export async function addSaleAbonoAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const saleId = formData.get('saleId') as string;
  const amount = Number(formData.get('amount') || '0');
  const currency = formData.get('currency') as Currency;
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);

  try {
    await connectDb();
    const saleRepo = new MongoSaleRepository();
    const movementRepo = new MongoMovementRepository();
    await addSaleAbono(
      user.userId,
      saleId,
      { amount, currency, accountId, date },
      saleRepo,
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

  redirect('/pos/sales');
}

export async function editSaleAbonoAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const saleId = formData.get('saleId') as string;
  const abonoId = formData.get('abonoId') as string;
  const amount = Number(formData.get('amount') || '0');
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);

  try {
    await connectDb();
    const saleRepo = new MongoSaleRepository();
    const movementRepo = new MongoMovementRepository();
    await editSaleAbono(
      user.userId,
      saleId,
      abonoId,
      { amount, accountId, date },
      saleRepo,
      movementRepo,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to edit abono',
    };
  }

  redirect('/pos/sales');
}

export async function deleteSaleAbonoAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const saleId = formData.get('saleId') as string;
  const abonoId = formData.get('abonoId') as string;

  try {
    await connectDb();
    const saleRepo = new MongoSaleRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteSaleAbono(user.userId, saleId, abonoId, saleRepo, movementRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
  }

  redirect('/pos/sales');
}

export async function deleteSaleAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const saleId = formData.get('saleId') as string;

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
    const saleRepo = new MongoSaleRepository();
    const movementRepo = new MongoMovementRepository();
    await deleteSale(user.userId, saleId, saleRepo, catalogRepo, movementRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
  }

  redirect('/pos/sales');
}
