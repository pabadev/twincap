import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Hashed one-time auth token (R13-B) shared by password reset and email
 * verification via the `purpose` discriminator.
 *
 * SECURITY: only the bcrypt HASH of the token is stored (`tokenHash`) — the
 * plain token never touches the database. `tokenHash` is unique. One active
 * token per user+purpose is enforced by the repository (revoke-on-use); a
 * TTL index auto-expires documents after `expiresAt`.
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

// TTL index — MongoDB auto-deletes expired tokens.
AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthTokenDocument = InferSchemaType<typeof AuthTokenSchema>;

export const AuthTokenModel =
  mongoose.models.AuthToken || mongoose.model('AuthToken', AuthTokenSchema);
