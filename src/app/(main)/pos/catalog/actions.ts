'use server';

import {
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from '../../../../core/application/catalog';
import type { CatalogItemType } from '../../../../core/domain/catalog';
import type { SerializedCatalogItem } from '../../../../core/domain/catalog';
import type { Currency } from '../../../../core/domain/currency';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { MongoSaleRepository } from '../../../../infrastructure/repositories/sale-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { objectIdGenerator } from '../../../../infrastructure/config/id-generator';
import { revalidatePath } from 'next/cache';
import { handleActionError } from '../../../../lib/handle-action-error';

const ids = objectIdGenerator;

export type CatalogItemActionResult = {
  error?: string;
  success?: string;
  /** Snapshot of the created/updated item — lets flows like the sale form auto-select it. */
  item?: SerializedCatalogItem;
};

export async function createCatalogItemAction(
  _prev: CatalogItemActionResult | null,
  formData: FormData,
): Promise<CatalogItemActionResult> {
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
    const item = await createCatalogItem(
      user.workspaceId!,
      { name, unitPrice, currency, type, stock },
      catalogRepo,
      ids,
    );
    revalidatePath('/pos/catalog');
    revalidatePath('/pos/sales');
    return { success: 'catalogItemCreated', item: item.toJSON() };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCatalogItemAction(
  _prev: CatalogItemActionResult | null,
  formData: FormData,
): Promise<CatalogItemActionResult> {
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
    const item = await updateCatalogItem(
      user.workspaceId!,
      itemId,
      { name, unitPrice, currency, stock },
      catalogRepo,
    );
    revalidatePath('/pos/catalog');
    revalidatePath('/pos/sales');
    return { success: 'catalogItemUpdated', item: item.toJSON() };
  } catch (error) {
    return handleActionError(error);
  }
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
    await deleteCatalogItem(user.workspaceId!, itemId, catalogRepo, saleRepo);
    revalidatePath('/pos/catalog');
    revalidatePath('/pos/sales');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'catalogItemDeleted' };
}
