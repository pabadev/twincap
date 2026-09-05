'use server';

import {
  createMovement,
  deleteMovement,
  updateMovement,
  listMovementsPaged,
} from '../../../core/application/movements';
import type { CreateMovementInput } from '../../../core/application/movements';
import type { MovementContext, SerializedMovement } from '../../../core/domain/movement';
import { isMovementContext } from '../../../core/domain/movement';
import { listAccounts } from '../../../core/application/accounts';
import { listCategories } from '../../../core/application/categories';
import type { SerializedAccount } from '../../../core/domain/account';
import type { SerializedCategory } from '../../../core/domain/category';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { claimIdempotency, releaseIdempotency } from '../../../infrastructure/auth/idempotency';
import { objectIdGenerator } from '../../../infrastructure/config/id-generator';
import { revalidatePath } from 'next/cache';
import { assertBusinessDateNotFuture, businessDateToInputValue } from '../../../lib/date';
import { handleActionError } from '../../../lib/handle-action-error';
import { serializeEntities } from '../../../lib/serialize';
import { withAudit } from '../../../lib/with-audit';
import { MongoOperationLogger } from '../../../infrastructure/repositories/operation-log-repository';
import { trackAnalytics } from '../../../lib/track-analytics';
import { getT } from '../../../i18n/server';
import { buildMovementsCsv, filterMovementsForCsv } from './export-csv';
import type { MovementCsvFilters } from './export-csv';

const ids = objectIdGenerator;

export async function createMovementAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'error.unauthorized' };

  const accountId = formData.get('accountId') as string;
  const type = formData.get('type') as CreateMovementInput['type'];
  const amount = Number(formData.get('amount') || '0');
  const currency = formData.get('currency') as CreateMovementInput['currency'];
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const note = (formData.get('note') as string) || undefined;
  const categoryId = formData.get('categoryId') as string;
  const contextRaw = formData.get('context') as string | null;
  let context: MovementContext | undefined;
  if (contextRaw && isMovementContext(contextRaw)) {
    context = contextRaw;
  }
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();

    // Idempotency: claim the client key before creating
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'createMovement');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'createMovement',
        entityType: 'movement',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }

    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'createMovement', entityType: 'movement', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const movementRepo = new MongoMovementRepository();
        const categoryRepo = new MongoCategoryRepository();
        const accountRepo = new MongoAccountRepository();
        return createMovement(
          user.workspaceId!,
          { accountId, type, amount, currency, date, note, categoryId, context },
          movementRepo,
          categoryRepo,
          ids,
          accountRepo,
        );
      },
    );
    revalidatePath('/movements');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    // R13-G: track first movement (deduplicated per workspace — only one doc ever).
    await trackAnalytics('firstMovement', user.workspaceId!, user.userId);
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'createMovement');
    return handleActionError(error);
  }

  return { success: 'movementCreated' };
}

export async function listAccountsAction(): Promise<SerializedAccount[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const accounts = await listAccounts(user.workspaceId!, accountRepo);
  return serializeEntities(accounts);
}

export async function listCategoriesAction(): Promise<SerializedCategory[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  await connectDb();
  const categoryRepo = new MongoCategoryRepository();
  const categories = await listCategories(user.workspaceId!, categoryRepo);
  return serializeEntities(categories);
}

export async function deleteMovementAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'error.unauthorized' };

  const movementId = formData.get('movementId') as string;

  try {
    await connectDb();
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteMovement', entityType: 'movement', userId: user.userId },
      () => {
        const movementRepo = new MongoMovementRepository();
        return deleteMovement(user.workspaceId!, movementId, movementRepo);
      },
    );
    revalidatePath('/movements');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'movementDeleted' };
}

export async function updateMovementAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'error.unauthorized' };

  const movementId = formData.get('movementId') as string;
  const accountId = formData.get('accountId') as string;
  const amount = Number(formData.get('amount') || '0');
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const note = (formData.get('note') as string) || undefined;
  const categoryId = formData.get('categoryId') as string;
  const contextRaw = formData.get('context') as string | null;
  let context: MovementContext | undefined;
  if (contextRaw && isMovementContext(contextRaw)) {
    context = contextRaw;
  }

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'updateMovement', entityType: 'movement', userId: user.userId },
      () => {
        const movementRepo = new MongoMovementRepository();
        const categoryRepo = new MongoCategoryRepository();
        return updateMovement(
          user.workspaceId!,
          { movementId, amount, accountId, categoryId, date, note, context },
          movementRepo,
          categoryRepo,
        );
      },
    );
    revalidatePath('/movements');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'movementUpdated' };
}

/** Serializable cursor for the server action boundary. */
export interface SerializedCursor {
  date: string;
  createdAt: string;
}

export interface PagedMovementsResult {
  items: SerializedMovement[];
  nextCursor: SerializedCursor | null;
}

export async function listMovementsPagedAction(
  limit: number,
  cursor?: SerializedCursor,
): Promise<PagedMovementsResult> {
  const user = await getCurrentUser();
  if (!user) return { items: [], nextCursor: null };

  await connectDb();
  const movementRepo = new MongoMovementRepository();
  const result = await listMovementsPaged(
    user.workspaceId!,
    limit,
    movementRepo,
    cursor
      ? { date: new Date(cursor.date), createdAt: new Date(cursor.createdAt) }
      : undefined,
  );

  return {
    items: serializeEntities(result.items),
    nextCursor: result.nextCursor
      ? { date: result.nextCursor.date.toISOString(), createdAt: result.nextCursor.createdAt.toISOString() }
      : null,
  };
}

/**
 * R13-H3: full-fetch CSV export of movements honoring the client's current
 * list filters. The session's workspaceId is the tenant scope — filters come
 * from the client but data access never leaves the user's workspace.
 */
export async function exportMovementsCsvAction(
  filters: MovementCsvFilters,
): Promise<{ ok: true; csv: string; filename: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'error.unauthorized' };

  try {
    await connectDb();
    const movementRepo = new MongoMovementRepository();
    const accountRepo = new MongoAccountRepository();
    const categoryRepo = new MongoCategoryRepository();
    const [movements, accounts, categories] = await Promise.all([
      movementRepo.findByWorkspaceId(user.workspaceId!),
      accountRepo.findByWorkspaceId(user.workspaceId!),
      categoryRepo.findByWorkspaceId(user.workspaceId!),
    ]);

    const accountNames: Record<string, string> = {};
    for (const account of accounts) accountNames[account.id] = account.name;
    const categoryNames: Record<string, string> = {};
    for (const category of categories) categoryNames[category.id] = category.name;

    const t = await getT('Export');
    const labels = {
      income: t('income'),
      expense: t('expense'),
      date: t('date'),
      type: t('type'),
      account: t('account'),
      category: t('category'),
      amount: t('amount'),
      currency: t('currency'),
      note: t('note'),
      noCategory: t('noCategory'),
    };

    const filtered = filterMovementsForCsv(serializeEntities(movements), filters);
    const csv = buildMovementsCsv(
      filtered,
      { accountNames, categoryNames },
      labels,
    );
    const date = businessDateToInputValue(new Date());
    return { ok: true, csv, filename: `movements_${date}.csv` };
  } catch (error) {
    return { ok: false, error: handleActionError(error).error };
  }
}
