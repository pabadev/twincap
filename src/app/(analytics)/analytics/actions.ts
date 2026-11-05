"use server";

import { connectDb } from "../../../infrastructure/db/connection";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { DefaultAnalyticsAuthorizer } from "../../../infrastructure/auth/analytics-authorizer";
import {
  parseExcludedEmails,
  resolveExcludedWorkspaceIds,
} from "../../../infrastructure/auth/analytics-exclusion";
import { MongoUserRepository } from "../../../infrastructure/repositories/user-repository";
import { MongoMembershipRepository } from "../../../infrastructure/repositories/membership-repository";
import { AnalyticsEventModel } from "../../../infrastructure/models/analytics-event";
import { Types } from "mongoose";
import { notFound, redirect } from "next/navigation";
import { computeAnalyticsMetrics } from "../../../core/application/analytics/compute-analytics-metrics";
import type {
  AnalyticsAction,
  AnalyticsEventName,
  AnalyticsFeature,
  AnalyticsMetricScope,
} from "../../../core/application/ports";

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
  /** Total accounts created (regular appended events). */
  totalAccountsCreated: number;
  /** Total workspaces with at least one movement (deduplicated first-event semantics). */
  totalFirstMovements: number;
  /** Total dashboard views (regular appended events). */
  totalDashboardViews: number;
  /** Total sales created (regular appended events). */
  totalSalesCreated: number;
  /** Total movements created — regular appended events, one per movement (real volume; drives activation). */
  totalMovementsCreated: number;
  /** Total transfers created (regular appended events). */
  totalTransfersCreated: number;
  /** Total credits received created (regular appended events). */
  totalCreditReceivedCreated: number;
  /** Total credits granted created (regular appended events). */
  totalCreditGrantedCreated: number;
  /** Total payables created (regular appended events). */
  totalPayablesCreated: number;
  activationEligibleWorkspaces: number;
  activatedWorkspaces: number;
  activationRate: number | null;
  retention7dEligibleWorkspaces: number;
  returned7dWorkspaces: number;
  retention7d: number | null;
  retention30dEligibleWorkspaces: number;
  returned30dWorkspaces: number;
  retention30d: number | null;
  /** Distinct workspaces with a value action during the rolling window. */
  activeWorkspaces7d: number;
  activeWorkspaces30d: number;
  activePersonalWorkspaces30d: number;
  activeBusinessWorkspaces30d: number;
  featureUsage30d: Array<{ feature: AnalyticsFeature; events: number; workspaces: number }>;
  /** Average movements created per registered workspace (regular events, not the deduplicated first-event). */
  avgMovementsPerUser: number;
}

export async function getAnalyticsDashboardAction(): Promise<AnalyticsDashboard> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // R13-G hardening: the action re-checks the analytics authorization policy —
  // the page's gate is NOT the only boundary. This keeps metrics private even
  // if the action is invoked from another surface.
  const authorizer = new DefaultAnalyticsAuthorizer();
  const allowed = await authorizer.canView(user.userId, user.email ?? "");
  if (!allowed) notFound();

  await connectDb();

  // Fase 6 / N3: resolve ANALYTICS_EXCLUDE_EMAILS → workspaceIds to keep the
  // founder's own account out of the global aggregate. Repositories are created
  // AFTER connectDb() per the connection rule. Absent → no exclusion (queries
  // below stay unchanged).
  const excludedEmails = parseExcludedEmails(process.env.ANALYTICS_EXCLUDE_EMAILS);
  const excludedWorkspaceIds =
    excludedEmails.length > 0
      ? await resolveExcludedWorkspaceIds(excludedEmails, {
          findByEmail: (email) => new MongoUserRepository().findByEmail(email),
          findWorkspaceIdsByUser: async (userId) =>
            (await new MongoMembershipRepository().findByUserId(userId)).map((m) => m.workspaceId),
        })
      : [];
  const excluded =
    excludedWorkspaceIds.length > 0
      ? { $nin: excludedWorkspaceIds.map((id) => new Types.ObjectId(id)) }
      : undefined;

  const allEvents = await AnalyticsEventModel.find({
    ...(excluded ? { workspaceId: excluded } : {}),
  }).lean();
  const metricEvents = allEvents.map((event) => ({
    eventName: event.eventName as AnalyticsEventName,
    workspaceId: event.workspaceId.toString(),
    occurredAt: event.occurredAt,
    feature: event.feature as AnalyticsFeature | undefined,
    action: event.action as AnalyticsAction | undefined,
    metricScope: event.metricScope as AnalyticsMetricScope | undefined,
    context: event.context as "Personal" | "Business" | undefined,
  }));
  const metrics = computeAnalyticsMetrics(metricEvents, new Date());
  const count = (eventName: AnalyticsEventName) =>
    allEvents.filter((event) => event.eventName === eventName).length;
  const totalRegistered = metrics.totalRegistered;
  const totalLoggedIn = count("firstLogin");
  const totalAccountsCreated = count("accountCreated");
  const totalFirstMovements = count("firstMovement");
  const totalDashboardViews = count("dashboardViewed");
  const totalSalesCreated = count("saleCreated");
  const totalMovementsCreated = metrics.totalMovementsCreated;
  const totalTransfersCreated = count("transferCreated");
  const totalCreditReceivedCreated = count("creditReceivedCreated");
  const totalCreditGrantedCreated = count("creditGrantedCreated");
  const totalPayablesCreated = count("payableCreated");
  const avgMovementsPerUser =
    totalRegistered > 0 ? Math.round((totalMovementsCreated / totalRegistered) * 10) / 10 : 0;

  return {
    totalRegistered,
    totalLoggedIn,
    totalAccountsCreated,
    totalFirstMovements,
    totalDashboardViews,
    totalSalesCreated,
    totalMovementsCreated,
    totalTransfersCreated,
    totalCreditReceivedCreated,
    totalCreditGrantedCreated,
    totalPayablesCreated,
    activationEligibleWorkspaces: metrics.activationEligibleWorkspaces,
    activatedWorkspaces: metrics.activatedWorkspaces,
    activationRate: metrics.activationRate,
    retention7dEligibleWorkspaces: metrics.retention7dEligibleWorkspaces,
    returned7dWorkspaces: metrics.returned7dWorkspaces,
    retention7d: metrics.retention7d,
    retention30dEligibleWorkspaces: metrics.retention30dEligibleWorkspaces,
    returned30dWorkspaces: metrics.returned30dWorkspaces,
    retention30d: metrics.retention30d,
    activeWorkspaces7d: metrics.activeWorkspaces7d,
    activeWorkspaces30d: metrics.activeWorkspaces30d,
    activePersonalWorkspaces30d: metrics.activePersonalWorkspaces30d,
    activeBusinessWorkspaces30d: metrics.activeBusinessWorkspaces30d,
    featureUsage30d: metrics.featureUsage30d,
    avgMovementsPerUser,
  };
}
