import type {
  AuthTokenRecord,
  AuthTokenPurpose,
  AuthTokenStore,
} from '../../core/application/ports';
import { AuthTokenModel, type AuthTokenDocument } from '../models/auth-token';
import { sessionOf } from '../transactions/mongo-unit-of-work';
import type { TransactionHandle } from '../../core/domain/transaction';

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

/** Mongoose duplicate-key error (E11000) — same code check as rate-limiter.ts. */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  );
}

/**
 * MongoDB-backed AuthTokenStore (R13-B). Persists ONLY the hashed token
 * (never the plain value) and supports one active (non-used, non-expired)
 * token per user+purpose.
 */
export class MongoAuthTokenRepository implements AuthTokenStore {
  async create(record: AuthTokenRecord): Promise<AuthTokenRecord> {
    // R15.3.2 P2-3: exactly ONE active (used:false) token per user+purpose.
    // Revoke previous actives BEFORE inserting (soft delete via used:true) —
    // consumed/expired tokens never count, only the active slot does. The
    // partial unique index is the DB backstop for concurrent creates: on a
    // genuine race the loser gets E11000, re-revokes (which also retires the
    // winner's token — newest always wins) and retries the insert exactly
    // ONCE. Any other failure propagates untouched.
    const data = {
      userId: record.userId,
      purpose: record.purpose,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      used: record.used ?? false,
    };
    const revokeActive = () =>
      AuthTokenModel.updateMany(
        { userId: record.userId, purpose: record.purpose, used: false },
        { $set: { used: true } },
      ).exec();

    await revokeActive();
    try {
      const doc = await AuthTokenModel.create(data);
      return toRecord(doc as unknown as AuthTokenDocument);
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      await revokeActive();
      const doc = await AuthTokenModel.create(data);
      return toRecord(doc as unknown as AuthTokenDocument);
    }
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

  /**
   * Atomically consume — the filter used:false + expiresAt > now makes exactly
   * one concurrent caller win. Mongoose casts the string tokenId to ObjectId
   * in the updateOne filter.
   * @param tx optional transaction handle (R15.3.2 §26): when present, the
   *   consume joins the caller's transaction — resetPassword/verifyEmail write
   *   the user update in the SAME transaction, so a failing update rolls the
   *   consumption back and the token stays usable.
   */
  async consume(tokenId: string, tx?: TransactionHandle): Promise<boolean> {
    const now = new Date();
    const result = await AuthTokenModel.updateOne(
      { _id: tokenId, used: false, expiresAt: { $gt: now } },
      { $set: { used: true } },
      { session: sessionOf(tx) },
    ).exec();
    return result.modifiedCount === 1;
  }

  /** Opportunistic cleanup of expired tokens (TTL index also handles it). */
  async deleteExpired(): Promise<void> {
    const now = new Date();
    await AuthTokenModel.deleteMany({ expiresAt: { $lte: now } }).exec();
  }
}
