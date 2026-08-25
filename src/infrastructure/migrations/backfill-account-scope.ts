import { AccountModel } from "../models/account";

export interface BackfillResult {
  /** Documents matching the missing-scope filter. */
  matched: number;
  /** Documents actually updated by this run (0 on re-runs — idempotent). */
  modified: number;
}

/**
 * D3 backfill: set scope='Personal' on every account document created before
 * the field existed. Idempotent and non-destructive — it only touches
 * documents where scope is missing or null, never overwrites an existing
 * value, and is safe to run any number of times.
 */
export async function backfillAccountScope(): Promise<BackfillResult> {
  const result = await AccountModel.updateMany(
    { $or: [{ scope: { $exists: false } }, { scope: null }] },
    { $set: { scope: "Personal" } },
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
}
