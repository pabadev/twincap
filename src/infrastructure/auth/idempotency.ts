import { IdempotencyModel } from '../models/idempotency';

/**
 * Idempotency guard for Server Actions.
 *
 * A client generates a unique key (UUID) before submitting a create action
 * and passes it as a hidden form field. The server tries to claim the key
 * atomically via a unique index on (userId, action, key). Only ONE request
 * wins the claim; concurrent/duplicate submissions get a deterministic
 * "duplicate" signal and must NOT re-run the work.
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
 *
 * Keys auto-expire after 24h via TTL index.
 */
export async function claimIdempotency(
  userId: string,
  key: string | undefined | null,
  action: string,
): Promise<boolean> {
  // No key provided → caller opted out (backward compat); allow but no protection.
  if (!key || key.trim().length === 0) return true;

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
 */
export async function releaseIdempotency(
  userId: string,
  key: string | undefined | null,
  action: string,
): Promise<void> {
  if (!key || key.trim().length === 0) return;
  await IdempotencyModel.deleteOne({ userId, action, key: key.trim() });
}
