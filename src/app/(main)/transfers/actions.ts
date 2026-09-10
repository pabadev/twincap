'use server';

import {
  createTransfer,
  updateTransfer,
  deleteTransfer,
} from '../../../core/application/transfers';
import type { CreateTransferInput, UpdateTransferInput } from '../../../core/application/transfers';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoCreditReceivedRepository } from '../../../infrastructure/repositories/credit-received-repository';
import { MongoCreditGrantedRepository } from '../../../infrastructure/repositories/credit-granted-repository';
import { MongoSaleRepository } from '../../../infrastructure/repositories/sale-repository';
import { MongoPayableRepository } from '../../../infrastructure/repositories/payable-repository';
import { MongoUnitOfWork } from '../../../infrastructure/transactions/mongo-unit-of-work';
import { connectDb } from '../../../infrastructure/db/connection';
import { claimIdempotency, releaseIdempotency } from '../../../infrastructure/auth/idempotency';
import { objectIdGenerator } from '../../../infrastructure/config/id-generator';
import { revalidatePath } from 'next/cache';
import { assertBusinessDateNotFuture } from '../../../lib/date';
import { handleActionError } from '../../../lib/handle-action-error';
import { withAudit } from '../../../lib/with-audit';
import { MongoOperationLogger } from '../../../infrastructure/repositories/operation-log-repository';
import { trackAnalytics } from '../../../lib/track-analytics';

const ids = objectIdGenerator;

export async function createTransferAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{
  error?: string;
  success?: string;
  warning?: { type: 'insufficient_funds'; currentBalance: number; projectedBalance: number; currency: string };
}> {
  const user = await getCurrentUser();
  if (!user) return { error: 'error.unauthorized' };

  const sourceAccountId = formData.get('sourceAccountId') as string;
  const destinationAccountId = formData.get('destinationAccountId') as string;
  const sourceAmount = Number(formData.get('sourceAmount') || '0');
  const sourceCurrency = formData.get('sourceCurrency') as CreateTransferInput['sourceCurrency'];
  const destinationAmount = Number(formData.get('destinationAmount') || '0') || undefined;
  const destinationCurrency = (formData.get('destinationCurrency') as CreateTransferInput['destinationCurrency']) || undefined;
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const note = (formData.get('note') as string) || undefined;
  const idempotencyKey = formData.get('idempotencyKey') as string;
  if (!idempotencyKey) {
    return { error: 'error.idempotencyKeyRequired' };
  }
  const confirmNegativeBalance = formData.get('confirmNegativeBalance') === 'true';

  const input: CreateTransferInput = {
    sourceAccountId,
    destinationAccountId,
    sourceAmount,
    sourceCurrency,
    destinationAmount,
    destinationCurrency,
    date,
    note,
    confirmNegativeBalance,
  };

  // R15.1 Fase 5: the use case returns EITHER a written transfer or a
  // structured insufficient-funds warning. The result must be inspected
  // AFTER the audit wrapper (which only logs — it does not consume the
  // value), so the warning can be surfaced to the frontend as data.
  let result!: Awaited<ReturnType<typeof createTransfer>>;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const claimed = await claimIdempotency(user.userId, idempotencyKey, 'createTransfer');
    if (!claimed) {
      await new MongoOperationLogger().log({
        userId: user.userId,
        action: 'createTransfer',
        entityType: 'transfer',
        result: 'duplicate',
        correlationId: idempotencyKey ?? undefined,
        occurredAt: new Date(),
      });
      return { error: 'error.duplicateRequest' };
    }
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'createTransfer', entityType: 'transfer', userId: user.userId, correlationId: idempotencyKey ?? undefined },
      async () => {
        const transferRepo = new MongoTransferRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        result = await createTransfer(
          user.workspaceId!,
          input,
          transferRepo,
          movementRepo,
          ids,
          accountRepo,
          // R15.2: parent repos for the live-parent balance derivation.
          new MongoCreditReceivedRepository(),
          new MongoCreditGrantedRepository(),
          new MongoSaleRepository(),
          new MongoPayableRepository(),
          new MongoUnitOfWork(),
        );
        // Audit records the entityId only when a transfer was actually
        // written; a warning emits a success record with no entity.
        return result.transfer?.id ?? undefined;
      },
    );
    if (result.warning) {
      // The request was processed but NOTHING was written. Release the
      // idempotency claim (mirroring the catch block) so the user's
      // confirmation resubmission with the SAME key — same mounted form —
      // is not dropped as a duplicate. The claim stays consumed until then:
      // that is the intended retry flow (same key + confirmNegativeBalance).
      await releaseIdempotency(user.userId, idempotencyKey, 'createTransfer');
      return { warning: result.warning };
    }
    // Post-commit is safe by design: the financial commit already happened and the
    // idempotency key prevents duplicate effects on retry — revalidation failure
    // only leaves a temporarily stale UI cache (R15.1 6b), never a repeated effect.
    revalidatePath('/transfers');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
    // R13-H: regular transfer creation event (APPENDED) for product analytics.
    await trackAnalytics('transferCreated', user.workspaceId!, user.userId);
  } catch (error) {
    await releaseIdempotency(user.userId, idempotencyKey, 'createTransfer');
    return handleActionError(error);
  }

  return { success: 'transferCreated' };
}

export async function updateTransferAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{
  error?: string;
  success?: string;
  warning?: { type: 'insufficient_funds'; currentBalance: number; projectedBalance: number; currency: string };
}> {
  const user = await getCurrentUser();
  if (!user) return { error: 'error.unauthorized' };

  const transferId = formData.get('transferId') as string;
  const sourceAmount = Number(formData.get('sourceAmount') || '0');
  const destinationAmount = Number(formData.get('destinationAmount') || '0') || undefined;
  const date = new Date(formData.get('date') as string);
  const tzOffset = Number(formData.get('tzOffset') ?? 0);
  const note = (formData.get('note') as string) || undefined;
  const confirmNegativeBalance = formData.get('confirmNegativeBalance') === 'true';

  const input: UpdateTransferInput = {
    sourceAmount,
    destinationAmount,
    date,
    note,
    confirmNegativeBalance,
  };

  // R15.2 D1: the use case returns EITHER a written transfer or a structured
  // insufficient-funds warning (same contract as createTransferAction). The
  // result must be inspected AFTER the audit wrapper (which only logs — it
  // does not consume the value), so the warning can surface to the frontend
  // as data and the shared confirm modal can re-submit with the field.
  let result!: Awaited<ReturnType<typeof updateTransfer>>;

  try {
    assertBusinessDateNotFuture(date, tzOffset);
    await connectDb();
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'updateTransfer', entityType: 'transfer', userId: user.userId },
      async () => {
        const transferRepo = new MongoTransferRepository();
        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        result = await updateTransfer(
          user.workspaceId!,
          transferId,
          input,
          transferRepo,
          movementRepo,
          accountRepo,
          // R15.2 D1: parent repos for the live-parent balance derivation
          // (same set as createTransfer).
          new MongoCreditReceivedRepository(),
          new MongoCreditGrantedRepository(),
          new MongoSaleRepository(),
          new MongoPayableRepository(),
          new MongoUnitOfWork(),
        );
        // Audit records the entityId only when the edit was actually
        // written; a warning emits a success record with no entity.
        return result.transfer?.id ?? undefined;
      },
    );
    if (result.warning) {
      // The edit was processed but NOTHING was written. Update has no
      // idempotency claim to release — the same mounted form simply
      // re-submits with confirmNegativeBalance and the edit registers.
      return { warning: result.warning };
    }
    revalidatePath('/transfers');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'transferUpdated' };
}

export async function deleteTransferAction(
  _prev: { error?: string; success?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'error.unauthorized' };

  const transferId = formData.get('transferId') as string;

  try {
    await connectDb();
    const logger = new MongoOperationLogger();
    await withAudit(
      logger,
      { action: 'deleteTransfer', entityType: 'transfer', userId: user.userId },
      () => {
        const transferRepo = new MongoTransferRepository();
        const movementRepo = new MongoMovementRepository();
        return deleteTransfer(
          user.workspaceId!,
          transferId,
          transferRepo,
          movementRepo,
          new MongoUnitOfWork(),
        );
      },
    );
    revalidatePath('/transfers');
    revalidatePath('/accounts');
    revalidatePath('/dashboard');
    revalidatePath('/movements');
  } catch (error) {
    return handleActionError(error);
  }

  return { success: 'transferDeleted' };
}
