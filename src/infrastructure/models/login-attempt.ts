import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Login failure attempt record (R15.3.2 P2-5).
 *
 * PURPOSE: extend the per-email lockout ACROSS rotated IPs. The login rate
 * limiter is keyed by email+IP (fixed window), so an attacker rotating IPs
 * gets a fresh counter per IP and could brute-force the same email forever.
 * This collection counts failures PER EMAIL regardless of source IP.
 *
 * Rule (enforced by src/infrastructure/auth/login-attempts.ts): >= 5
 * failures within a rolling 60-minute window → the email is locked out for
 * 30 minutes measured from the LAST failure. Collection docs are kept 24h
 * (TTL) so the email+IP audit trail survives well beyond the failure window,
 * which itself is evaluated at query time.
 *
 * This is an infrastructure record, NOT a domain entity.
 */
const LoginAttemptSchema = new Schema(
  {
    /** Normalized email (trimmed, lowercase) — the lockout key. */
    email: { type: String, required: true },
    /** Source IP of the failing attempt (best effort; 'unknown' allowed). */
    ip: { type: String, required: true },
    /** Instant of the failed attempt. */
    createdAt: { type: Date, required: true, default: () => new Date() },
    /** TTL expiry (now + 24h) — MongoDB auto-deletes past this point. */
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: false, versionKey: false },
);

// Query index: failure window scan for one email (createdAt range match) and
// reset cleanup by email — the email prefix serves both.
LoginAttemptSchema.index({ email: 1, createdAt: -1 });

// TTL index — MongoDB auto-deletes expired attempt records.
LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginAttemptDocument = InferSchemaType<typeof LoginAttemptSchema>;

export const LoginAttemptModel =
  mongoose.models.LoginAttempt ||
  mongoose.model('LoginAttempt', LoginAttemptSchema);