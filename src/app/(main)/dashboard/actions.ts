"use server";

import { redirect } from "next/navigation";
import type { DashboardFilters } from "@/core/application/dashboard/dashboard-types";
import type { DashboardSnapshot } from "@/core/application/dashboard/dashboard-types";
import { getCurrentUser } from "@/infrastructure/auth/getCurrentUser";
import { connectDb } from "@/infrastructure/db/connection";
import { readDashboardSnapshot } from "@/infrastructure/dashboard/read-dashboard-snapshot";
import { reportUnexpectedErrorAndWait } from "@/lib/report-unexpected-error";
import { trackAnalytics } from "@/lib/track-analytics";

/** Shared snapshot composition keeps the dashboard and MCP figures aligned. */
export async function getDashboardSnapshotAction(
  filters: DashboardFilters,
  tzOffsetMinutes = 0,
): Promise<DashboardSnapshot> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    await connectDb();
    const snapshot = await readDashboardSnapshot(user.workspaceId!, filters, tzOffsetMinutes);
    await trackAnalytics("dashboardViewed", user.workspaceId!, user.userId);
    return snapshot;
  } catch (error) {
    await reportUnexpectedErrorAndWait(error);
    throw error;
  }
}
