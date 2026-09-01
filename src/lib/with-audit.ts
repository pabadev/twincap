import type { OperationLogger, OperationLogRecord } from '../core/application/ports';

const MAX_ERROR_CODE_LENGTH = 200;

/**
 * Instrumentation wrapper for a financial mutation, writing a durable audit
 * record (R12 C2).
 *
 * - On success: records result (default 'success'), durationMs, and entityId
 *   when the wrapped fn returns one.
 * - On error: records result 'error' with a short classified errorCode (the
 *   domain messages are short and classified, e.g. 'Account has references...'
 *   — NO stack traces), writes the log BEFORE re-throwing so the server action
 *   resumes its normal error handling. The error is re-thrown unchanged; the
 *   action's return contract is untouched.
 * - The log write is best-effort: the wrapper guards each logger.log() call so
 *   that even a misbehaving logger that throws cannot break the financial
 *   operation (MongoOperationLogger itself never throws, but this is hardened
 *   against any OperationLogger implementation).
 *
 * The wrapper only measures the MUTATION (connectDb + use case). revalidatePath
 * stays outside so a revalidate hiccup is not confused with the operation's
 * own success/failure.
 *
 * @returns exactly what fn returned (propagated unchanged on both paths).
 */
export async function withAudit<T>(
  logger: OperationLogger,
  opts: {
    action: string;
    entityType: string;
    userId: string;
    correlationId?: string;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();

  try {
    const out = await fn();
    const durationMs = Date.now() - start;
    const maybeResult =
      out &&
      typeof out === 'object' &&
      'result' in out &&
      (out as { result?: unknown }).result;
    const result =
      maybeResult === 'error' || maybeResult === 'duplicate' ? maybeResult : 'success';
    const entityId =
      out && typeof out === 'object' && 'entityId' in out
        ? (out as { entityId?: string }).entityId
        : undefined;

    const record: OperationLogRecord = {
      userId: opts.userId,
      action: opts.action,
      entityType: opts.entityType,
      result: result as 'success' | 'error' | 'duplicate',
      correlationId: opts.correlationId,
      durationMs,
      occurredAt: new Date(),
    };
    if (entityId) record.entityId = entityId;

    await writeLogBestEffort(logger, record);
    return out;
  } catch (error: unknown) {
    const durationMs = Date.now() - start;
    const errorCode =
      error instanceof Error && error.message
        ? error.message.slice(0, MAX_ERROR_CODE_LENGTH)
        : 'unknown_error';

    await writeLogBestEffort(logger, {
      userId: opts.userId,
      action: opts.action,
      entityType: opts.entityType,
      result: 'error',
      correlationId: opts.correlationId,
      durationMs,
      errorCode,
      occurredAt: new Date(),
    });

    // Re-throw AFTER logging so the server action keep its normal error handling.
    throw error;
  }
}

/** Emits the record without letting a logger failure break the operation. */
async function writeLogBestEffort(
  logger: OperationLogger,
  record: OperationLogRecord,
): Promise<void> {
  try {
    await logger.log(record);
  } catch {
    // Best-effort: a throwing logger must not break the mutation.
  }
}
