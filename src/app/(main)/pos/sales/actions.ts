'use server';

import {
  createSale,
  addSaleAbono,
  deleteSaleAbono,
  deleteSale,
  getSaleDetail,
  type SaleDetailSnapshot,
} from '../../../../core/application/sales';
import type { Currency } from '../../../../core/domain/currency';
import type { PaymentMode } from '../../../../core/domain/sale';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCatalogItemRepository } from '../../../../infrastructure/repositories/catalog-repository';
import { MongoSaleRepository } from '../../../../infrastructure/repositories/sale-repository';
import { MongoMovementRepository } from '../../../../infrastructure/repositories/movement-repository';
import { MongoClientRepository } from '../../../../infrastructure/repositories/client-repository';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { MongoCreditGrantedRepository } from '../../../../infrastructure/repositories/credit-granted-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { claimIdempotency, releaseIdempotency } from '../../../../infrastructure/auth/idempotency';
import { objectIdGenerator } from '../../../../infrastructure/config/id-generator';
import { assertBusinessDateNotFuture } from '../../../../lib/date';
import { handleActionError } from '../../../../lib/handle-action-error';
import { revalidatePath } from 'next/cache';
import { withAudit } from '../../../../lib/with-audit';
import { MongoOperationLogger } from '../../../../infrastructure/repositories/operation-log-repository';

const ids = objectIdGenerator;

export async function createSaleAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const lineItemsJson = formData.get('lineItems') as string;
  const accountId = formData.get('accountId') as string;
  const clientId = (formData.get('clientId') as string) || undefined;
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const paymentMode = formData.get('paymentMode') as PaymentMode;
  const currency = formData.get('currency') as Currency;
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  let items: { itemId: string; quantity: number; unitPrice: number }[];
  try {
    items = JSON.parse(lineItemsJson);
  } catch {
    return { error: 'Invalid line items data' };
  }

  if (!items || items.length === 0) {
    return { error: 'Sale must have at least one line item' };
  }

  // H14: upfront payment applies only to on-credit sales.
  const initialPaymentRaw = formData.get('initialPayment');
  const initialPayment =
    paymentMode === 'on-credit' && initialPaymentRaw !== null
      ? Number(initialPaymentRaw)
      : undefined;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'createSale');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'createSale',
        entityType: 'sale',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'createSale', entityType: 'sale', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const catalogRepo = new MongoCatalogItemRepository();
        const saleRepo = new MongoSaleRepository();
        const movementRepo = new MongoMovementRepository();
        const clientRepo = new MongoClientRepository();
        const creditRepo = new MongoCreditGrantedRepository();
        const accountRepo = new MongoAccountRepository();
        return createSale(
          user.workspaceId!,
          { items, accountId, clientId, date, paymentMode, currency, initialPayment },
          saleRepo,
          catalogRepo,
          movementRepo,
          ids,
          clientRepo,
          creditRepo,
          accountRepo,
        );
      },
    );
    revalidatePath('/pos/sales');
    revalidatePath('/pos/catalog');
    revalidatePath('/credits/granted');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'createSale');
    return handleActionError(error);
  }

  return { success: 'saleCreated' };
}

export async function addSaleAbonoAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const saleId = formData.get('saleId') as string;
  const amount = Number(formData.get('amount') || '0');
  const currency = formData.get('currency') as Currency;
  const accountId = formData.get('accountId') as string;
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'addSaleAbono');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'addSaleAbono',
        entityType: 'sale',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'addSaleAbono', entityType: 'sale', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const saleRepo = new MongoSaleRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        return addSaleAbono(
          user.workspaceId!,
          saleId,
          { amount, currency, accountId, date },
          saleRepo,
          movementRepo,
          ids,
          accountRepo,
        );
      },
    );
    revalidatePath('/pos/sales');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'addSaleAbono');
    return handleActionError(error);
  }

  return { success: 'abonoAdded' };
}

export async function deleteSaleAbonoAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const saleId = formData.get('saleId') as string;
  const abonoId = formData.get('abonoId') as string;

  try {
    await connectDb();
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteSaleAbono', entityType: 'sale', userId: user.userId },
      () => {
        const saleRepo = new MongoSaleRepository();
        const movementRepo = new MongoMovementRepository();
        return deleteSaleAbono(user.workspaceId!, saleId, abonoId, saleRepo, movementRepo);
      },
    );
    revalidatePath('/pos/sales');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'abonoDeleted' };
}

export async function deleteSaleAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const saleId = formData.get('saleId') as string;

  try {
    await connectDb();
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteSale', entityType: 'sale', userId: user.userId },
      () => {
        const catalogRepo = new MongoCatalogItemRepository();
        const saleRepo = new MongoSaleRepository();
        const movementRepo = new MongoMovementRepository();
        const creditRepo = new MongoCreditGrantedRepository();
        return deleteSale(user.workspaceId!, saleId, saleRepo, catalogRepo, movementRepo, creditRepo);
      },
    );
    revalidatePath('/pos/sales');
    revalidatePath('/pos/catalog');
    revalidatePath('/credits/granted');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'saleDeleted' };
}

export type SaleDetailResult =
  | { ok: true; sale: SaleDetailSnapshot }
  | { ok: false; error: string };

/**
 * H17: full detail snapshot for one sale (read-only). The userId always comes
 * from the session — never from the client — so the read stays tenant-scoped.
 */
export async function getSaleDetailAction(
  saleId: string,
): Promise<SaleDetailResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'error.unauthorized' };

  try {
    await connectDb();
    const saleRepo = new MongoSaleRepository();
    const clientRepo = new MongoClientRepository();
    const catalogRepo = new MongoCatalogItemRepository();
    const accountRepo = new MongoAccountRepository();
    const creditRepo = new MongoCreditGrantedRepository();
    const snapshot = await getSaleDetail(
      user.workspaceId!,
      saleId,
      saleRepo,
      clientRepo,
      catalogRepo,
      accountRepo,
      creditRepo,
    );
    return { ok: true, sale: snapshot };
  } catch (error) {
    return { ok: false, error: handleActionError(error).error };
  }
}
