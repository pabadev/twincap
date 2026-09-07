import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Rate limit entry — fixed window counter per key (R14-C).
 *
 * The unique index on `key` guarantees exactly one document per key, so
 * concurrent `$inc` writes serialize on the same document (the rate limiter's
 * atomic path). TTL index auto-expires documents after `expiresAt`.
 * Key format: `<scope>:<identifier>` (e.g. `login:user@example.com:127.0.0.1`).
 */
const RateLimitSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    attempts: { type: Number, required: true, default: 1 },
    windowStart: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false },
);

// TTL index — MongoDB auto-deletes after expiresAt
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDocument = InferSchemaType<typeof RateLimitSchema>;

export const RateLimitModel =
  mongoose.models.RateLimit || mongoose.model('RateLimit', RateLimitSchema);
