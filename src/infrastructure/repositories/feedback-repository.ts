import type { FeedbackRecord, FeedbackStore } from '../../core/application/ports';
import { FeedbackModel } from '../models/feedback';
import { isDbConnected } from '../db/connection';

/**
 * MongoDB-backed FeedbackStore (R14-L §11).
 *
 * WRITES ARE BEST-EFFORT: a failure to persist the feedback record must NEVER
 * break the submit flow. On failure (or when no DB connection is active — e.g.
 * unit tests that mock connectDb and repositories), a structured JSON error is
 * emitted to stderr and the repository returns normally (no re-throw).
 *
 * Server actions call connectDb() before touching repositories (project rule),
 * so by the time record() runs there is normally an active connection. The
 * guard uses the existing isDbConnected() helper: with no live connection the
 * underlying Model.create() would otherwise buffer/hang, so we skip the write
 * and record the failure instead.
 *
 * No internal connectDb() here (the actions own that).
 */
export class MongoFeedbackRepository implements FeedbackStore {
  async record(record: FeedbackRecord): Promise<void> {
    if (!isDbConnected()) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'feedback_write_failed',
          kind: record.kind,
          userId: record.userId,
          error: 'no active mongodb connection',
        }),
      );
      return;
    }

    try {
      await FeedbackModel.create(record);
    } catch (err: unknown) {
      // Best-effort: never propagate — the submit flow must flow.
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'feedback_write_failed',
          kind: record.kind,
          userId: record.userId,
          error: message,
        }),
      );
    }
  }
}