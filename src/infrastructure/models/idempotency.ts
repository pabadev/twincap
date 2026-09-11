import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Idempotency record — dedupes duplicate Server Action submissions.
 *
 * A client generates a unique key (UUID) before submitting a create action
 * and passes it as a hidden form field. The server records the key + result
 * so a retry/double-click returns the stored outcome without re-running.
 *
 * R15.3 §20 — workspace scoping:
 * The unique index is `(userId, action, key)`, NOT `(workspaceId, ...)`.
 * This is safe because the 1-user → 1-workspace guarantee is structural
 * (`register()` creates exactly one workspace per user, atomically, and the
 * workspace migration is a per-user upsert). A key collision across
 * workspaces is therefore impossible: only one workspace exists per user.
 *
 * IF the product ever allows 1 user → N workspaces, this schema MUST be
 * evolved to scope the unique index by workspaceId BEFORE that ships — the
 * current shape would silently dedupe across workspaces.
 *
 * TTL index auto-expires records after 24h (fresh UUID per submit; real
 * retries happen within seconds/minutes; `releaseIdempotency` clears the
 * record on failure — no queued-retry infrastructure exists).
 *
 * R15.3 §27 — the guarantee lives in MONGODB (unique index + TTL), not in
 * any in-memory store: there is no process-local state. It survives backend
 * restart and multiple backend instances by construction — the persisted
 * record is what dedupes, regardless of which process claimed it.
 */
const IdempotencySchema = new Schema(
  {
    userId: { type: String, required: true },
    key: { type: String, required: true },
    /** Action name (e.g. 'createSale') so keys are scoped per action. */
    action: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false, versionKey: false },
);

// Unique per user+action+key
IdempotencySchema.index({ userId: 1, action: 1, key: 1 }, { unique: true });
// TTL — auto-delete after 24h
IdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export type IdempotencyDocument = InferSchemaType<typeof IdempotencySchema>;

export { IdempotencySchema };

export const IdempotencyModel =
  mongoose.models.Idempotency || mongoose.model('Idempotency', IdempotencySchema);
