import { Types } from "mongoose";
import type { IdGenerator } from "../../core/application/ports";

/**
 * Production id generator — returns a Mongo ObjectId string.
 * Persisted as the real `_id` so cross-document refs (link.refId, saleId,
 * movementId) always match the parent's actual _id. Replaces crypto.randomUUID,
 * which was being discarded by the mappers (Mongo assigned a different ObjectId),
 * causing orphan movements that inflated balances. See Ronda 7 / R7-B.
 */
export const objectIdGenerator: IdGenerator = {
  generate: () => new Types.ObjectId().toString(),
};