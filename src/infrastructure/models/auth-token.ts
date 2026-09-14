import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Hashed one-time auth token (R13-B) shared by password reset and email
 * verification via the `purpose` discriminator.
 *
 * SECURITY: only the bcrypt HASH of the token is stored (`tokenHash`) — the
 * plain token never touches the database. `tokenHash` is unique.
 *
 * ONE-ACTIVE invariant (R15.3.2 P2-3): at most ONE active (used:false) token
 * per user+purpose, enforced at the DB level by the partial unique index on
 * (userId, purpose) filtered to used:false — the repository revoke-before-
 * insert is the happy path, and this index backstops concurrent creates
 * (winner inserts, loser gets E11000 and retries the revoke once, newest
 * wins). Consumed (used:true) and expired tokens accumulate freely. A TTL
 * index auto-expires documents after `expiresAt`.
 *
 * This is an infrastructure record, NOT a domain entity.
 */
export const AuthTokenSchema = new Schema(
  {
    /** Owning user. */
    userId: { type: String, required: true, index: true },
    /** Purpose: 'password_reset' | 'email_verify'. */
    purpose: {
      type: String,
      required: true,
      enum: ['password_reset', 'email_verify'],
      index: true,
    },
    /** bcrypt hash of the one-time token. */
    tokenHash: { type: String, required: true, unique: true },
    /** When the token stops being valid. */
    expiresAt: { type: Date, required: true },
    /** True once consumed (one-time use). */
    used: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, versionKey: false },
);

// Compound index: active token lookup for a user+purpose (newest first).
AuthTokenSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

// R15.3.2 P2-3: the ONE-ACTIVE-per-(user,purpose) invariant as a DB
// constraint. The partial filter (used:false) keeps the unique window tight:
// only active tokens compete for uniqueness, and consume()'s used:true flip
// frees the slot — exactly one new token can be created per user+purpose at
// any moment, even under concurrent creates (the repository revokes + retries
// once on E11000).
AuthTokenSchema.index(
  { userId: 1, purpose: 1 },
  { unique: true, partialFilterExpression: { used: false } },
);

// TTL index — MongoDB auto-deletes expired tokens.
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthTokenDocument = InferSchemaType<typeof AuthTokenSchema>;

export const AuthTokenModel =
  mongoose.models.AuthToken || mongoose.model('AuthToken', AuthTokenSchema);
