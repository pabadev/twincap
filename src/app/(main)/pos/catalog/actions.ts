'use server';

import { redirect } from 'next/navigation';
import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from '../../../../core/application/catalog';
import type { CatalogItemType } from '../../../../core/domain/catalog';
import type { Currency } from '../../../../core/domain/currency';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { MongoSaleRepository } from '../../../../infrastructure/repositories/sale-repository';

const catalogRepo = new MongoCatalogItemRepository();
const saleRepo = new MongoSaleRepository();
const ids = { generate: () => crypto.randomUUID() };

export async function createCatalogItemAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const name = formData.get('name') as string;
  const unitPrice = Number(formData.get('unitPrice') || '0');
  const currency = formData.get('currency') as Currency;
  const type = formData.get('type') as CatalogItemType;
  const stockRaw = formData.get('stock');
  const stock = stockRaw !== null && stockRaw !== '' ? Number(stockRaw) : undefined;

  try {
    await createCatalogItem(
      user.userId,
      { name, unitPrice, currency, type, stock },
      catalogRepo,
      ids,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to create catalog item',
    };
  }

  redirect('/pos/catalog');
}

export async function updateCatalogItemAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const itemId = formData.get('itemId') as string;
  const name = formData.get('name') as string;
  const unitPrice = Number(formData.get('unitPrice') || '0');
  const currency = formData.get('currency') as Currency;
  const stockRaw = formData.get('stock');
  const stock = stockRaw !== null && stockRaw !== '' ? Number(stockRaw) : undefined;

  try {
    await updateCatalogItem(
      user.userId,
      itemId,
      { name, unitPrice, currency, stock },
      catalogRepo,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to update catalog item',
    };
  }

  redirect('/pos/catalog');
}

export async function deleteCatalogItemAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const itemId = formData.get('itemId') as string;

  try {
    await deleteCatalogItem(user.userId, itemId, catalogRepo, saleRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
  }

  redirect('/pos/catalog');
}
