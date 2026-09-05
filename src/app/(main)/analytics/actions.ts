'use server';

import { connectDb } from '../../../infrastructure/db/connection';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { DefaultAnalyticsAuthorizer } from '../../../infrastructure/auth/analytics-authorizer';
import {
  parseExcludedEmails,
  resolveExcludedWorkspaceIds,
} from '../../../infrastructure/auth/analytics-exclusion';
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
import { MongoMembershipRepository } from '../../../infrastructure/repositories/membership-repository';
import { AnalyticsEventModel } from '../../../infrastructure/models/analytics-event';
import { Types } from 'mongoose';
import { notFound, redirect } from 'next/navigation';

/**
 * Analytics dashboard snapshot (R13-G).
 *
 * Returns activation, retention, and usage metrics for the beta. No PII —
 * only workspace-scoped event counts and derived percentages.
 *
 * This is a simple aggregation over the AnalyticsEvent collection. For the
 * closed beta (10–20 users) the collection is tiny; no optimization needed.
 *
 * DATA EXCLUSION (Fase 6 / N3): the optional env var
 * `ANALYTICS_EXCLUDE_EMAILS` (comma-separated) excludes the workspaces owned
 * by those emails from the aggregate — so the founder's own account stops
 * dirtying activation/retention. Emails are resolved to workspaceIds and
 * excluded via `workspaceId: { $nin: [...] }` on every query below. Absent →
 * no exclusion (deny/clean-data by default).
 */
export interface AnalyticsDashboard {
  /** Total unique workspaces that registered. */
  totalRegistered: number;
  /** Total unique workspaces that logged in. */
  totalLoggedIn: number;
  /** Total accounts created. */
  totalAccountsCreated: number;
  /** Total workspaces with at least one movement. */
  totalFirstMovements: number;
  /** Total dashboard views. */
  totalDashboardViews: number;
  /** Total sales created. */
  totalSalesCreated: number;
  /** Activation rate: % of registered workspaces with ≥3 movements within 2 days of registration. */
  activationRate: number;
  /** Retention 7d: % of registered workspaces active in the last 7 days. */
  retention7d: number;
  /** Retention 30d: % of registered workspaces active in the last 30 days. */
  retention30d: number;
  /** Average number of movements per active workspace. */
  avgMovementsPerUser: number;
}

export async function getAnalyticsDashboardAction(): Promise<AnalyticsDashboard> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // R13-G hardening: the action re-checks the analytics authorization policy —
  // the page's gate is NOT the only boundary. This keeps metrics private even
  // if the action is invoked from another surface.
  const authorizer = new DefaultAnalyticsAuthorizer();
  const allowed = await authorizer.canView(user.userId, user.email ?? '');
  if (!allowed) notFound();

  await connectDb();

  // Fase 6 / N3: resolve ANALYTICS_EXCLUDE_EMAILS → workspaceIds to keep the
  // founder's own account out of the global aggregate. Repositories are created
  // AFTER connectDb() per the connection rule. Absent → no exclusion (queries
  // below stay unchanged).
  const excludedEmails = parseExcludedEmails(process.env.ANALYTICS_EXCLUDE_EMAILS);
  const excludedWorkspaceIds = excludedEmails.length > 0
    ? await resolveExcludedWorkspaceIds(excludedEmails, {
        findByEmail: (email) => new MongoUserRepository().findByEmail(email),
        findWorkspaceIdsByUser: async (userId) =>
          (await new MongoMembershipRepository().findByUserId(userId)).map(
            (m) => m.workspaceId,
          ),
      })
    : [];
  const excluded = excludedWorkspaceIds.length > 0
    ? { $nin: excludedWorkspaceIds.map((id) => new Types.ObjectId(id)) }
    : undefined;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Count events by name (unique workspaces for "first" events).
  const [registerEvents, loginEvents, accountEvents, movementEvents, dashboardEvents, saleEvents] =
    await Promise.all([
      AnalyticsEventModel.find({
        eventName: 'register',
        ...(excluded ? { workspaceId: excluded } : {}),
      }).lean(),
      AnalyticsEventModel.find({
        eventName: 'firstLogin',
        ...(excluded ? { workspaceId: excluded } : {}),
      }).lean(),
      AnalyticsEventModel.find({
        eventName: 'accountCreated',
        ...(excluded ? { workspaceId: excluded } : {}),
      }).lean(),
      AnalyticsEventModel.find({
        eventName: 'firstMovement',
        ...(excluded ? { workspaceId: excluded } : {}),
      }).lean(),
      AnalyticsEventModel.find({
        eventName: 'dashboardViewed',
        ...(excluded ? { workspaceId: excluded } : {}),
      }).lean(),
      AnalyticsEventModel.find({
        eventName: 'saleCreated',
        ...(excluded ? { workspaceId: excluded } : {}),
      }).lean(),
    ]);

  const totalRegistered = registerEvents.length;
  const totalLoggedIn = loginEvents.length;
  const totalAccountsCreated = accountEvents.length;
  const totalFirstMovements = movementEvents.length;
  const totalDashboardViews = dashboardEvents.length;
  const totalSalesCreated = saleEvents.length;

  // Activation: % of registered workspaces with ≥3 movements within 2 days of registration.
  let activatedCount = 0;
  for (const reg of registerEvents) {
    const regDate = reg.occurredAt as Date;
    const twoDaysLater = new Date(regDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const wsMovements = movementEvents.filter(
      (m) =>
        m.workspaceId.toString() === reg.workspaceId.toString() &&
        (m.occurredAt as Date) <= twoDaysLater,
    );
    if (wsMovements.length >= 3) {
      activatedCount++;
    }
  }
  const activationRate = totalRegistered > 0
    ? Math.round((activatedCount / totalRegistered) * 100)
    : 0;

  // Retention 7d/30d: workspaces with any event in the last 7/30 days.
  const allEvents = await AnalyticsEventModel.find({
    occurredAt: { $gte: thirtyDaysAgo },
    ...(excluded ? { workspaceId: excluded } : {}),
  }).lean();

  const active7d = new Set(
    allEvents
      .filter((e) => (e.occurredAt as Date) >= sevenDaysAgo)
      .map((e) => e.workspaceId.toString()),
  );
  const active30d = new Set(allEvents.map((e) => e.workspaceId.toString()));

  const retention7d = totalRegistered > 0
    ? Math.round((active7d.size / totalRegistered) * 100)
    : 0;
  const retention30d = totalRegistered > 0
    ? Math.round((active30d.size / totalRegistered) * 100)
    : 0;

  // Usage: average movements per workspace (from firstMovement events — 1 per workspace).
  const avgMovementsPerUser = totalRegistered > 0
    ? Math.round((totalFirstMovements / totalRegistered) * 10) / 10
    : 0;

  return {
    totalRegistered,
    totalLoggedIn,
    totalAccountsCreated,
    totalFirstMovements,
    totalDashboardViews,
    totalSalesCreated,
    activationRate,
    retention7d,
    retention30d,
    avgMovementsPerUser,
  };
}
