import { IdempotencyModel } from '../models/idempotency';
import { ValidationError } from '../../core/domain/errors';

/**
 * Idempotency guard for Server Actions.
 *
 * A client generates a unique key (UUID) before submitting a financial
 * operation and passes it as a hidden form field (IdempotencyField). The
 * server tries to claim the key atomically via a unique index on
 * (userId, action, key). Only ONE request wins the claim; concurrent or
 * duplicate submissions get a deterministic "duplicate" signal and must NOT
 * re-run the work.
 *
 * R15.3 §19 — MANDATORY key policy (no silent opt-out):
 *
 * REQUIRED (guard): every operation that CREATES money-movement state or
 * financial documents — creates, abonos (addAbono), initial balances and
 * mark-as-paid / write-off transitions — MUST receive an idempotency key.
 * Those are the operations where a double submit would duplicate financial
 * state. Each server action enforces this by returning
 * `{ error: 'error.idempotencyKeyRequired' }` BEFORE touching any repository.
 *
 * OPTIONAL (no key needed): edits (editAbono / editPrincipal / editTotal /
 * update*) are naturally idempotent because they are directed at a known id
 * and applied by replacement — running them twice converges to the same
 * result. No key is required there.
 *
 * TTL: keys auto-expire after 24h (see models/idempotency.ts for the §20
 * justification). Real retries happen within seconds/minutes; a failed
 * request releases its key so the user can retry immediately.
 *
 * R15.3 §27 — the dedupe guarantee lives in MONGODB (unique index
 * (userId, action, key) + TTL), not in memory: this module keeps NO
 * process-local state, so the guarantee survives backend restart and
 * multiple backend instances. Verified by
 * src/infrastructure/auth/idempotency-restart.test.ts.
 *
 * Usage (after auth + connectDb):
 *
 *   const claimed = await claimIdempotency(user.userId, key, 'createSale');
 *   if (!claimed) return { error: 'duplicateRequest' };   // already handled
 *
 *   try {
 *     ... perform the create ...
 *   } catch (e) {
 *     await releaseIdempotency(user.userId, key, 'createSale'); // allow retry on failure
 *     throw e;
 *   }
 */
export async function claimIdempotency(
  userId: string,
  key: string | undefined | null,
  action: string,
): Promise<boolean> {
  // §19: a missing key is a programming error, not "opt out". Actions must
  // return error.idempotencyKeyRequired BEFORE reaching this point; this
  // throw is defense in depth so no financial operation can ever run without
  // dedupe protection.
  if (!key || key.trim().length === 0) {
    throw new ValidationError(
      'Idempotency key is required for this financial operation (R15.3 §19)',
    );
  }

  try {
    await IdempotencyModel.create({
      userId,
      key: key.trim(),
      action,
      createdAt: new Date(),
    });
    return true;
  } catch (error: unknown) {
    // E11000 duplicate key → an earlier request already claimed it
    const code = (error as { code?: number })?.code;
    if (code === 11000) return false;
    // Any other error → fail closed (do not proceed with duplicate work)
    throw error;
  }
}

/**
 * Releases a claimed key so a failed request can be retried.
 * Call in a catch block when the work failed (otherwise the key would be
 * "burned" for 24h even though nothing was created).
 * Missing key → no-op (callers that never claimed have nothing to release).
 */
export async function releaseIdempotency(
  userId: string,
  key: string | undefined | null,
  action: string,
): Promise<void> {
  if (!key || key.trim().length === 0) return;
  await IdempotencyModel.deleteOne({ userId, action, key: key.trim() });
}