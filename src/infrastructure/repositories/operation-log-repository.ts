import type { OperationLogger, OperationLogRecord } from '../../core/application/ports';
import { OperationLogModel } from '../models/operation-log';
import { isDbConnected } from '../db/connection';

/**
 * MongoDB-backed OperationLogger.
 *
 * WRITES ARE BEST-EFFORT (R12 C2 decision): a failure to persist the audit
 * record must NEVER break the financial operation it accompanies. On failure
 * (or when no DB connection is active — e.g. unit tests that mock connectDb and
 * repositories), a structured JSON error is emitted to stderr and the logger
 * returns normally (no re-throw).
 *
 * Server actions call connectDb() before touching repositories (project rule),
 * so by the time log() runs there is normally an active connection. The
 * guard uses the existing isDbConnected() helper: with no live connection the
 * underlying Model.create() would otherwise buffer/hang, so we skip the write
 * and record the failure instead.
 *
 * No internal connectDb() here (the actions own that).
 */
export class MongoOperationLogger implements OperationLogger {
  async log(record: OperationLogRecord): Promise<void> {
    if (!isDbConnected()) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'audit_log_write_failed',
          action: record.action,
          entityType: record.entityType,
          userId: record.userId,
          error: 'no active mongodb connection',
        }),
      );
      return;
    }

    try {
      await OperationLogModel.create(record);
    } catch (err: unknown) {
      // Best-effort: never propagate — the financial operation must flow.
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'audit_log_write_failed',
          action: record.action,
          entityType: record.entityType,
          userId: record.userId,
          error: message,
        }),
      );
    }
  }
}
