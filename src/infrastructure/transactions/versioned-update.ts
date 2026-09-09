import type { ClientSession, FilterQuery, Model, UpdateQuery } from "mongoose";

/**
 * R15-F4 — single-document update with optional optimistic concurrency (CAS).
 *
 * When `expectedVersion` is undefined the write behaves exactly as before
 * (plain `updateOne`, no version check). When provided, the filter is extended
 * with `__v: expectedVersion` and a successful write bumps the version via
 * `$inc: { __v: 1 }` — the only place a debt document's `__v` ever increases
 * (repos use updateOne/findOneAndUpdate, which never auto-increment it).
 *
 * A matchedCount of 0 means either the document does not exist, it was modified
 * concurrently, or an extra guard in the filter did not match. Callers
 * translate this by re-reading the document (same session) and throw
 * NotFoundError / ConflictError(DEBT_MODIFIED_MSG) accordingly.
 *
 * @returns the matchedCount of the update.
 */
export async function runVersionedUpdate<D>(
  model: Model<D>,
  filter: FilterQuery<D>,
  update: UpdateQuery<D>,
  expectedVersion: number | undefined,
  session: ClientSession | undefined,
): Promise<number> {
  if (expectedVersion === undefined) {
    const result = await model.updateOne(filter, update, { session }).exec();
    return result.matchedCount;
  }
  const result = await model
    .updateOne(
      // `__v` is Mongoose's internal versionKey, absent from the doc
      // interfaces — the casts live here, the single adapter point where the
      // version mechanics are visible.
      { ...filter, __v: expectedVersion } as FilterQuery<D>,
      { ...update, $inc: { __v: 1 } } as UpdateQuery<D>,
      { session },
    )
    .exec();
  return result.matchedCount;
}