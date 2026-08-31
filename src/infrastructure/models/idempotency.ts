import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Idempotency record — dedupes duplicate Server Action submissions.
 *
 * A client generates a unique key (UUID) before submitting a create action
 * and passes it as a hidden form field. The server records the key + result
 * so a retry/double-click returns the stored outcome without re-running.
 *
 * TTL index auto-expires records after 24h.
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

export const IdempotencyModel =
  mongoose.models.Idempotency || mongoose.model('Idempotency', IdempotencySchema);
