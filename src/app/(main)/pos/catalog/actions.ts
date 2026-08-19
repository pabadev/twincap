'use server';

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
import { connectDb } from '../../../../infrastructure/db/connection';

const ids = { generate: () => crypto.randomUUID() };

export async function createCatalogItemAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const name = formData.get('name') as string;
  const unitPrice = Number(formData.get('unitPrice') || '0');
  const currency = formData.get('currency') as Currency;
  const type = formData.get('type') as CatalogItemType;
  const stockRaw = formData.get('stock');
  const stock = stockRaw !== null && stockRaw !== '' ? Number(stockRaw) : undefined;

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
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

  return { success: 'catalogItemCreated' };
}

export async function updateCatalogItemAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const itemId = formData.get('itemId') as string;
  const name = formData.get('name') as string;
  const unitPrice = Number(formData.get('unitPrice') || '0');
  const currency = formData.get('currency') as Currency;
  const stockRaw = formData.get('stock');
  const stock = stockRaw !== null && stockRaw !== '' ? Number(stockRaw) : undefined;

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
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

  return { success: 'catalogItemUpdated' };
}

export async function deleteCatalogItemAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const itemId = formData.get('itemId') as string;

  try {
    await connectDb();
    const catalogRepo = new MongoCatalogItemRepository();
    const saleRepo = new MongoSaleRepository();
    await deleteCatalogItem(user.userId, itemId, catalogRepo, saleRepo);
  } catch (error) {
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT'))
      throw error;
    return {
      error: error instanceof Error ? error.message : 'Failed to delete catalog item',
    };
  }

  return { success: 'catalogItemDeleted' };
}
