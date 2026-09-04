import type { AnalyticsReporter, AnalyticsEventName } from '../../core/application/ports';
import { AnalyticsEventModel } from '../models/analytics-event';
import { isDbConnected } from '../db/connection';
import { Types } from 'mongoose';

/**
 * "First" events that should only be recorded ONCE per workspace.
 * For these, the repository checks for an existing record before inserting.
 */
const FIRST_EVENTS: ReadonlySet<AnalyticsEventName> = new Set([
  'firstLogin',
  'firstMovement',
]);

/**
 * MongoDB-backed AnalyticsReporter (R13-G).
 *
 * WRITES ARE BEST-EFFORT: a failure to persist the analytics event must NEVER
 * break the operation it accompanies. On failure (or when no DB connection is
 * active), the error is logged to stderr and the method returns normally.
 *
 * "First" events (firstLogin, firstMovement) are deduplicated by workspaceId +
 * eventName: only ONE document is ever created per workspace per first-event.
 * Regular events (register, accountCreated, dashboardViewed, saleCreated) are
 * appended without dedup.
 */
export class MongoAnalyticsRepository implements AnalyticsReporter {
  async track(input: {
    eventName: AnalyticsEventName;
    workspaceId: string;
    userId: string;
  }): Promise<void> {
    if (!isDbConnected()) {
      console.error(
        JSON.stringify({
          level: 'warn',
          event: 'analytics_track_skipped',
          eventName: input.eventName,
          workspaceId: input.workspaceId,
          reason: 'no active mongodb connection',
        }),
      );
      return;
    }

    try {
      if (FIRST_EVENTS.has(input.eventName)) {
        // Idempotent upsert: create only if no record exists for this workspace+event.
        await AnalyticsEventModel.findOneAndUpdate(
          {
            workspaceId: new Types.ObjectId(input.workspaceId),
            eventName: input.eventName,
          },
          {
            $setOnInsert: {
              workspaceId: new Types.ObjectId(input.workspaceId),
              eventName: input.eventName,
              userId: input.userId,
              occurredAt: new Date(),
            },
          },
          { upsert: true },
        ).exec();
      } else {
        // Regular event: always append.
        await AnalyticsEventModel.create({
          eventName: input.eventName,
          workspaceId: new Types.ObjectId(input.workspaceId),
          userId: input.userId,
          occurredAt: new Date(),
        });
      }
    } catch (err: unknown) {
      // Best-effort: never propagate — the financial operation must flow.
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'warn',
          event: 'analytics_track_failed',
          eventName: input.eventName,
          workspaceId: input.workspaceId,
          error: message,
        }),
      );
    }
  }
}
