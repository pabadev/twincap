import type { ErrorEventInput } from '../core/application/ports';

/**
 * Non-blocking, fail-safe reporting of an unexpected error to the error
 * monitoring backend (R13-D).
 *
 * Use from server-only contexts (server actions, route handlers, proxy) where
 * you want to record a crash WITHOUT awaiting persistence — the caller's
 * return contract and control flow are NEVER changed by reporting.
 *
 * - Fires a dynamic `reportError` that NEVER throws (fail-safe).
 * - Respects the `ERROR_MONITORING_ENABLED` opt-in gate internally.
 * - Safe to call in a module that is also imported by unit tests (no DB side
 *   effect runs while monitoring is disabled).
 */
export function reportUnexpectedError(
  error: unknown,
  extra?: Partial<Omit<ErrorEventInput, 'message' | 'name' | 'stack'>>,
): void {
  try {
    const message =
      error instanceof Error ? error.message : String(error ?? 'unknown error');
    const name = error instanceof Error ? error.name : undefined;
    const stack = error instanceof Error ? error.stack : undefined;

    void import('../infrastructure/monitoring/error-monitor')
      .then(({ reportError }) =>
        reportError({
          message,
          name,
          stack,
          severity: 'error',
          expected: false,
          code: error instanceof Error ? error.name : undefined,
          ...extra,
        }),
      )
      .catch(() => {
        // Best-effort only.
      });
  } catch {
    // Never let reporting break the original error path.
  }
}

/** Async variant for callers that want to await persistence (best-effort). */
export async function reportUnexpectedErrorAndWait(
  error: unknown,
  extra?: Partial<Omit<ErrorEventInput, 'message' | 'name' | 'stack'>>,
): Promise<void> {
  try {
    const message =
      error instanceof Error ? error.message : String(error ?? 'unknown error');
    const name = error instanceof Error ? error.name : undefined;
    const stack = error instanceof Error ? error.stack : undefined;
    const { reportError } = await import('../infrastructure/monitoring/error-monitor');
    await reportError({
      message,
      name,
      stack,
      severity: 'error',
      expected: false,
      code: error instanceof Error ? error.name : undefined,
      ...extra,
    });
  } catch {
    // Best-effort only.
  }
}
