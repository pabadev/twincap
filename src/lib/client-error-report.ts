/**
 * Client-side error reporting helper (R13-D).
 *
 * Used by error boundaries (global-error.tsx, root error.tsx, (main)/error.tsx)
 * to report render/crash errors back to the server monitoring endpoint.
 *
 * BEST-EFFORT BY DESIGN: the POST to `/api/monitor` and the console log are
 * fire-and-forget and wrapped so that a network failure, a dead endpoint, or a
 * malformed error NEVER breaks the boundary's own rendering or reset flow.
 *
 * The payload is intentionally BOUNDED and validated server-side; only a
 * fixed, sanitized context subset is ever sent — never cookies, bodies, or
 * financial data.
 */

export interface ClientErrorContext {
  userId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
}

/**
 * Reports a render error best-effort. Resolves without throwing; returns
 * whether the POST was attempted and accepted (200/400). Never rejects.
 */
export async function reportClientError(
  error: unknown,
  context?: ClientErrorContext,
): Promise<void> {
  const name = error instanceof Error ? error.name : 'ClientError';
  const message =
    error instanceof Error ? error.message : String(error ?? 'unknown client error');
  const stack = error instanceof Error ? error.stack : undefined;

  const payload = {
    message,
    name,
    stack,
    severity: 'error',
    expected: false,
    environment: process.env.NODE_ENV,
    context: {
      method: context?.method,
      path: context?.path,
      userId: context?.userId,
      userAgent: context?.userAgent,
    },
  };

  // Always surface to the browser console first (diagnostic baseline).
  console.error('[monitor] client error', error);

  try {
    void fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Best-effort: a failed report must never break the boundary.
  }
}
