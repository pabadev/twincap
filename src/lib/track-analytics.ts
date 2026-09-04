import type { AnalyticsEventName } from '../core/application/ports';
import { MongoAnalyticsRepository } from '../infrastructure/repositories/analytics-repository';

/**
 * Best-effort analytics tracking helper (R13-G).
 *
 * Checks the ANALYTICS_ENABLED flag before attempting to track. When disabled
 * (default), this is a no-op — zero overhead, zero DB writes.
 *
 * Must NEVER throw — the calling action's financial operation always flows.
 */
export async function trackAnalytics(
  eventName: AnalyticsEventName,
  workspaceId: string,
  userId: string,
): Promise<void> {
  // Gate: analytics only runs when explicitly enabled (opt-in, default false).
  if (process.env.ANALYTICS_ENABLED !== 'true') return;

  try {
    const repo = new MongoAnalyticsRepository();
    await repo.track({ eventName, workspaceId, userId });
  } catch (err: unknown) {
    // Fallback safety net: even if the repository were to throw, analytics
    // must NEVER break the operation it accompanies (best-effort invariant).
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ level: 'warn', event: 'analytics_track_failed', eventName, error: message }),
    );
  }
}
