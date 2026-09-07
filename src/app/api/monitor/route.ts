import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reportError } from '../../../infrastructure/monitoring/error-monitor';
import { sanitizeContext } from '../../../infrastructure/monitoring/sanitize';
import { connectDb } from '../../../infrastructure/db/connection';
import { monitorRateLimiter } from '../../../infrastructure/auth/rate-limiter';
import { resolveClientIp } from '../../../infrastructure/auth/client-ip';

/**
 * Route handler for client-side error reporting (R13-D).
 *
 * WHY THIS ROUTE EXISTS: Next.js `global-error.tsx` and render error
 * boundaries are Client Components that CANNOT import server actions
 * directly, and the app has NO API routes today. A global error (a crash
 * that also killed the root layout) must still be reportable. This single,
 * narrow, POST-only endpoint receives a bounded and strictly-validated
 * payload from the client and persists it through the SAME
 * `MongoErrorEventRepository` / `reportError` path as server-side errors, so
 * client crashes and server crashes land in the same error-event collection.
 *
 * SECURITY: the endpoint NEVER trusts the body. It is validated and
 * sanitized with zod + the shared sanitizer before reaching persistence.
 * Any failure is fail-safe (never a 500 from a hostile/broken payload):
 * the route always resolves with 200 (or 400 for shape errors) and logs to
 * stderr instead of leaking. Since R14-C the route is rate limited per real
 * client IP (x-real-ip / x-forwarded-for), with a generous 120 requests per
 * 15 minutes — legitimate crash reports are never lost, but a single abusive
 * client cannot flood the monitoring sink.
 */

const MONITOR_BODY = z.object({
  message: z.string().min(1).max(500),
  name: z.string().max(100).optional(),
  stack: z.string().max(4000).optional(),
  severity: z.enum(['fatal', 'error', 'warning']).optional(),
  code: z.string().max(200).optional(),
  expected: z.boolean().optional(),
  context: z
    .object({
      userId: z.string().optional(),
      workspaceId: z.string().optional(),
      path: z.string().optional(),
      method: z.string().optional(),
      userAgent: z.string().optional(),
      correlationId: z.string().optional(),
    })
    .optional(),
  environment: z.string().max(50).optional(),
  release: z.string().max(100).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Rate limit BEFORE parsing — the check itself is DB-backed, so connect
    // first (cached no-op once up) to avoid Mongoose buffering timeouts on
    // cold serverless starts. Fail-safe: any unexpected error here is caught
    // by the wrapper below and never surfaces a 500.
    await connectDb();

    const ip = resolveClientIp(request.headers);
    const rate = await monitorRateLimiter.check(`monitor:${ip}`);
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
    }

    const raw = await request
      .json()
      .catch(() => {
        return null;
      });

    const parsed = MONITOR_BODY.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 });
    }

    const body = parsed.data;

    // Never trust client severity/defaults: cap at 'error' from unrecognized.
    const severity = body.severity ?? 'error';

    await reportError(
      {
        message: body.message,
        name: body.name,
        stack: body.stack,
        severity,
        expected: body.expected ?? false,
        code: body.code,
        context: body.context ? sanitizeContext(body.context) : undefined,
        environment: body.environment,
        release: body.release,
      },
      // Production path: NOT injected, so it respects the ERROR_MONITORING_ENABLED
      // gate. If disabled (default), reportError is a silent no-op → still 200.
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ level: 'error', event: 'monitor_route_failed', error: message }),
    );
    // Fail-safe: never surfacing a 500 for a client error report.
    return NextResponse.json({ ok: true });
  }
}
