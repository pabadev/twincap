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
import { claimIdempotency, releaseIdempotency } from '../../../infrastructure/auth/idempotency';
import { objectIdGenerator } from '../../../infrastructure/config/id-generator';
import { assertBusinessDateNotFuture } from '../../../lib/date';
import { handleActionError } from '../../../lib/handle-action-error';
import { revalidateMovementData } from '../../../lib/revalidate';
import { withAudit } from '../../../lib/with-audit';
import { MongoOperationLogger } from '../../../infrastructure/repositories/operation-log-repository';

const ids = objectIdGenerator;

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
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const dueDateRaw = formData.get('dueDate') as string;
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : undefined;
  const note = ((formData.get('note') as string) || '').trim() || undefined;
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'createPayable');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'createPayable',
        entityType: 'payable',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'createPayable', entityType: 'payable', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const payableRepo = new MongoPayableRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        return createPayable(
          user.userId,
          { counterparty, total, initialPayment, currency, accountId, date, dueDate, note },
          payableRepo,
          movementRepo,
          ids,
          accountRepo,
        );
      },
    );
    revalidateMovementData('/payables');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'createPayable');
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
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'addAbono');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'addAbono',
        entityType: 'payable',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'addAbono', entityType: 'payable', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const payableRepo = new MongoPayableRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        return addAbono(
          user.userId,
          payableId,
          { amount, currency, accountId, date },
          payableRepo,
          movementRepo,
          ids,
          accountRepo,
        );
      },
    );
    revalidateMovementData('/payables');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'addAbono');
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
  const tzOffset = Number(formData.get('tzOffset') ?? 0);

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'editAbono', entityType: 'payable', userId: user.userId },
      () => {
        const payableRepo = new MongoPayableRepository();
        const movementRepo = new MongoMovementRepository();
        return editAbono(
          user.userId,
          payableId,
          abonoId,
          { amount, date },
          payableRepo,
          movementRepo,
        );
      },
    );
    revalidateMovementData('/payables');
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
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'editPayable', entityType: 'payable', userId: user.userId },
      () => {
        const payableRepo = new MongoPayableRepository();
        return editTotal(
          user.userId,
          payableId,
          { total, currency },
          payableRepo,
        );
      },
    );
    revalidateMovementData('/payables');
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
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteAbono', entityType: 'payable', userId: user.userId },
      () => {
        const payableRepo = new MongoPayableRepository();
        const movementRepo = new MongoMovementRepository();
        return deleteAbono(user.userId, payableId, abonoId, payableRepo, movementRepo);
      },
    );
    revalidateMovementData('/payables');
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
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deletePayable', entityType: 'payable', userId: user.userId },
      () => {
        const payableRepo = new MongoPayableRepository();
        const movementRepo = new MongoMovementRepository();
        return deletePayable(user.userId, payableId, payableRepo, movementRepo);
      },
    );
    revalidateMovementData('/payables');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'payableDeleted' };
}
