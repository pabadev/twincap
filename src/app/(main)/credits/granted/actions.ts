'use server';

import {
  createCreditGranted,
  addAbono,
  editAbono,
  deleteAbono,
  editPrincipal,
  deleteCreditGranted,
  markAsPaid,
  writeOffCreditGranted,
} from '../../../../core/application/credits-granted';
import type { Currency } from '../../../../core/domain/currency';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoCreditGrantedRepository } from '../../../../infrastructure/repositories/credit-granted-repository';
import { MongoMovementRepository } from '../../../../infrastructure/repositories/movement-repository';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { claimIdempotency, releaseIdempotency } from '../../../../infrastructure/auth/idempotency';
import { objectIdGenerator } from '../../../../infrastructure/config/id-generator';
import { assertBusinessDateNotFuture } from '../../../../lib/date';
import { handleActionError } from '../../../../lib/handle-action-error';
import { revalidateMovementData } from '../../../../lib/revalidate';
import { withAudit } from '../../../../lib/with-audit';
import { MongoOperationLogger } from '../../../../infrastructure/repositories/operation-log-repository';

const ids = objectIdGenerator;

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
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const installments = Number(formData.get('installments') || '0') || undefined;
  const installmentValueValue = formData.get('installmentValue');
  const installmentValue = installmentValueValue ? Number(installmentValueValue) : undefined;
  const frequency = (formData.get('frequency') as string) || undefined;
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'createCreditGranted');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'createCreditGranted',
        entityType: 'creditGranted',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'createCreditGranted', entityType: 'creditGranted', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        return createCreditGranted(
          user.userId,
          { counterparty, principal, currency, accountId, date, installments, installmentValue, frequency },
          creditRepo,
          movementRepo,
          ids,
          accountRepo,
        );
      },
    );
    revalidateMovementData('/credits/granted');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'createCreditGranted');
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
        entityType: 'creditGranted',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'addAbono', entityType: 'creditGranted', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        return addAbono(
          user.userId,
          creditId,
          { amount, currency, accountId, date },
          creditRepo,
          movementRepo,
          ids,
          accountRepo,
        );
      },
    );
    revalidateMovementData('/credits/granted');
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

  const creditId = formData.get('creditId') as string;
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
      { action: 'editAbono', entityType: 'creditGranted', userId: user.userId },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        return editAbono(
          user.userId,
          creditId,
          abonoId,
          { amount, date },
          creditRepo,
          movementRepo,
          ids,
        );
      },
    );
    revalidateMovementData('/credits/granted');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'abonoUpdated' };
}

export async function editCreditGrantedAction(
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
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'editCreditGranted', entityType: 'creditGranted', userId: user.userId },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        return editPrincipal(
          user.userId,
          creditId,
          { principal, currency },
          creditRepo,
          movementRepo,
        );
      },
    );
    revalidateMovementData('/credits/granted');
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
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteAbono', entityType: 'creditGranted', userId: user.userId },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        return deleteAbono(user.userId, creditId, abonoId, creditRepo, movementRepo);
      },
    );
    revalidateMovementData('/credits/granted');
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
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteCreditGranted', entityType: 'creditGranted', userId: user.userId },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        return deleteCreditGranted(user.userId, creditId, creditRepo, movementRepo);
      },
    );
    revalidateMovementData('/credits/granted');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'creditDeleted' };
}

export async function markAsPaidAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const creditId = formData.get('creditId') as string;
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'markAsPaid');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'markAsPaid',
        entityType: 'creditGranted',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'markAsPaid', entityType: 'creditGranted', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        return markAsPaid(user.userId, creditId, creditRepo, movementRepo, ids, accountRepo);
      },
    );
    revalidateMovementData('/credits/granted');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'markAsPaid');
    return handleActionError(error);
  }

  return { success: 'creditMarkedAsPaid' };
}

export async function writeOffCreditAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'Unauthorized' };

  const creditId = formData.get('creditId') as string;
  const idempotencyKey = formData.get('idempotencyKey') as string | null;

  try {
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'writeOffCredit');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'writeOffCredit',
        entityType: 'creditGranted',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'writeOffCredit', entityType: 'creditGranted', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      () => {
        const creditRepo = new MongoCreditGrantedRepository();
        const movementRepo = new MongoMovementRepository();
        return writeOffCreditGranted(
          user.userId,
          creditId,
          creditRepo,
          movementRepo,
          ids,
        );
      },
    );
    revalidateMovementData('/credits/granted');
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'writeOffCredit');
    return handleActionError(error);
  }

  return { success: 'creditWrittenOff' };
}
