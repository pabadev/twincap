import mongoose from "mongoose";
import type { ClientSession } from "mongoose";
import type { UnitOfWork } from "../../core/application/ports";
import {
  transactionHandleBrand,
  type TransactionHandle,
} from "../../core/domain/transaction";

const MONGO_SESSION: unique symbol = Symbol("mongo-session");

/** Real Mongo handle: the opaque core handle plus the native session. */
export interface MongoTransactionHandle extends TransactionHandle {
  readonly [MONGO_SESSION]: ClientSession;
}

/**
 * Extract the native Mongo session from an opaque handle.
 * Mongo repository adapters only. Returns undefined when no transaction is
 * active (single-document path unchanged).
 */
export function sessionOf(tx?: TransactionHandle): ClientSession | undefined {
  return tx ? (tx as MongoTransactionHandle)[MONGO_SESSION] : undefined;
}

/**
 * R14-B real multi-document unit of work.
 * `session.withTransaction` starts/commits/aborts and retries on
 * TransientTransactionError (the Mongo driver handles the retry loop).
 */
export class MongoUnitOfWork implements UnitOfWork {
  async withTransaction<T>(fn: (tx: TransactionHandle) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    const handle: MongoTransactionHandle = {
      [transactionHandleBrand]: true,
      [MONGO_SESSION]: session,
    } as MongoTransactionHandle;
    try {
      return await session.withTransaction(() => fn(handle));
    } finally {
      await session.endSession();
    }
  }
}