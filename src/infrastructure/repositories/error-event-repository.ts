import type {
  ErrorEventInput,
  ErrorReporter,
} from '../../core/application/ports';
import { ErrorEventModel } from '../models/error-event';
import { isDbConnected } from '../db/connection';

/**
 * MongoDB-backed ErrorReporter (R13-D).
 *
 * WRITES ARE BEST-EFFORT (mirror of MongoOperationLogger): a failure to
 * persist an error event must NEVER break the operation that failed. On
 * failure (or when no DB connection is active) a structured JSON error is
 * emitted to stderr and the reporter returns normally (no re-throw).
 *
 * DEDUPE/GROUPING: one document per `fingerprint` (unique index). `report` is
 * an atomic `findOneAndUpdate({ fingerprint }, { $inc: { occurrenceCount },
 * $set: { lastSeen, ... } }, { upsert: true, includeResultMetadata: true })`:
 *   - If the upsert INSERTED the document (no prior match) → first occurrence,
 *     `isFirst: true`, `occurrenceCount: 1`, `firstSeen` fixed by the insert.
 *   - If a document already existed → the existing row's `firstSeen` is kept
 *     untouched and `occurrenceCount`/`lastSeen` are bumped, `isFirst: false`.
 *
 * This is idempotent against concurrent first reports: MongoDB guarantees at
 * most one document per unique `fingerprint`, so exactly one caller wins the
 * upsert and becomes `isFirst` — the rest see an existing row (no races, no
 * double counting beyond a benign duplicate $inc on a sequential first-second
 * frame, which is acceptable for telemetry).
 *
 * Consumers pass in a pre-sanitized input (see monitoring/sanitize.ts). The
 * repo additionally guards against a polluted `context`/stack by relying on
 * the sanitizer — the model limits sizes at the schema level only for Mongo.
 */
export class MongoErrorEventRepository implements ErrorReporter {
  async report(
    input: ErrorEventInput,
  ): Promise<{ isFirst: boolean; occurrenceCount: number }> {
    // Critical: an absent connection would make findOneAndUpdate buffer/hang.
    if (!isDbConnected()) {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'error_event_write_failed',
          name: input.name,
          code: input.code,
          error: 'no active mongodb connection',
        }),
      );
      return { isFirst: true, occurrenceCount: 1 };
    }

    const now = input.occurredAt ?? new Date();

    try {
      const doc = await ErrorEventModel.findOneAndUpdate(
        { fingerprint: input.fingerprint },
        {
          $inc: { occurrenceCount: 1 },
          $set: {
            message: input.message.slice(0, 500),
            lastSeen: now,
            environment: input.environment,
            lastUserId: input.context?.userId,
          },
          // Only fill absent fields on the FIRST insert (upsert), never touch
          // an existing row's firstSeen/name/stack/code/context/release/expected.
          $setOnInsert: {
            name: input.name,
            stack: input.stack?.slice(0, 4000),
            severity: input.severity,
            expected: input.expected,
            code: input.code,
            release: input.release,
            context: input.context,
            firstSeen: now,
            firstUserId: input.context?.userId,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          includeResultMetadata: true,
        },
      );

      const occurrenceCount =
        (doc.value?.occurrenceCount as number | undefined) ?? 1;
      const isFirst = Boolean(doc.lastErrorObject?.upserted);
      return { isFirst, occurrenceCount };
    } catch (err: unknown) {
      // Fail-safe: never propagate — the underlying operation must flow.
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'error_event_write_failed',
          name: input.name,
          code: input.code,
          error: message,
        }),
      );
      return { isFirst: true, occurrenceCount: 1 };
    }
  }
}
