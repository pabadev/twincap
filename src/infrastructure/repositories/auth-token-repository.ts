import type {
  AuthTokenRecord,
  AuthTokenPurpose,
  AuthTokenStore,
} from '../../core/application/ports';
import { AuthTokenModel, type AuthTokenDocument } from '../models/auth-token';

/** Map a Mongoose AuthToken document to the application AuthTokenRecord shape. */
function toRecord(doc: AuthTokenDocument): AuthTokenRecord {
  const rawId = (doc as unknown as { _id: { toString(): string } })._id;
  return {
    id: rawId.toString(),
    userId: doc.userId,
    purpose: doc.purpose as AuthTokenPurpose,
    tokenHash: doc.tokenHash,
    expiresAt: doc.expiresAt as unknown as Date,
    used: doc.used,
    createdAt: (doc.createdAt as unknown as Date) ?? new Date(),
  };
}

/**
 * MongoDB-backed AuthTokenStore (R13-B). Persists ONLY the hashed token
 * (never the plain value) and supports one active (non-used, non-expired)
 * token per user+purpose.
 */
export class MongoAuthTokenRepository implements AuthTokenStore {
  async create(record: AuthTokenRecord): Promise<AuthTokenRecord> {
    const doc = await AuthTokenModel.create({
      userId: record.userId,
      purpose: record.purpose,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      used: record.used ?? false,
    });
    return toRecord(doc as unknown as AuthTokenDocument);
  }

  /** Active (not used, not expired) token hash for a user+purpose, if any. */
  async findActiveByUser(
    userId: string,
    purpose: AuthTokenPurpose,
  ): Promise<AuthTokenRecord | null> {
    const now = new Date();
    const doc = await AuthTokenModel.findOne({
      userId,
      purpose,
      used: false,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .exec();
    return doc ? toRecord(doc as unknown as AuthTokenDocument) : null;
  }

  /** Revoke (mark used) all active tokens for a user+purpose. */
  async markUsed(userId: string, purpose: AuthTokenPurpose): Promise<void> {
    await AuthTokenModel.updateMany(
      { userId, purpose, used: false },
      { $set: { used: true } },
    ).exec();
  }

  /** Opportunistic cleanup of expired tokens (TTL index also handles it). */
  async deleteExpired(): Promise<void> {
    const now = new Date();
    await AuthTokenModel.deleteMany({ expiresAt: { $lte: now } }).exec();
  }
}
