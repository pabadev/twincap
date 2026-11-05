import { getAnalyticsDashboardAction } from "./actions";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { DefaultAnalyticsAuthorizer } from "../../../infrastructure/auth/analytics-authorizer";
import { notFound, redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { Table, TableShell, TBody, Td, Th, THead } from "../../../components/ui/table";

/**
 * Product analytics dashboard page (R13-G).
 *
 * Access is gated by the `AnalyticsAuthorizer` policy (founder-only today, via
 * ANALYTICS_ACCESS_EMAILS; role-based in the future). The page NEVER decides
 * access itself — it delegates to the policy so the rule is centralized.
 *
 * Unauthorized users get a 404 (opaque — the module is hidden, not revealed)
 * to match "hidden for other users at any level".
 */
export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const authorizer = new DefaultAnalyticsAuthorizer();
  const allowed = await authorizer.canView(user.userId, user.email ?? "");
  if (!allowed) notFound();

  const dashboard = await getAnalyticsDashboardAction();
  const t = await getT("Analytics");
  const usageByFeature = new Map(dashboard.featureUsage30d.map((usage) => [usage.feature, usage]));
  const featureRows = [
    ["accounts", "featureAccounts"],
    ["categories", "featureCategories"],
    ["movements", "featureMovements"],
    ["transfers", "featureTransfers"],
    ["creditReceived", "featureCreditReceived"],
    ["creditGranted", "featureCreditGranted"],
    ["payables", "featurePayables"],
    ["sales", "featureSales"],
    ["clients", "featureClients"],
    ["catalog", "featureCatalog"],
    ["inventory", "featureInventory"],
    ["exports", "featureExports"],
    ["support", "featureSupport"],
  ] as const;

  return (
    // Intentional content width (RSL-6): max-w-3xl (768px) keeps the metric
    // cards and charts readable without redesigning them. Canonical mapping
    // DEC-IA-06 ("the task defines the container") stays intact — lists use
    // max-w-6xl, forms max-w-xl, dashboard max-w-screen-2xl — and this
    // analytics dashboard is a deliberate narrower column for legibility.
    // The shell margin change in (analytics)/layout.tsx (lg:max-w-[min(1536px,
    // calc(100vw - 3rem))]) caps the OUTER shell; this inner content width is
    // unchanged.
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-sm text-surface-muted">{t("subtitle")}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label={t("registered")} value={dashboard.totalRegistered} />
        <MetricCard label={t("loggedIn")} value={dashboard.totalLoggedIn} />
        <MetricCard label={t("accountsCreated")} value={dashboard.totalAccountsCreated} />
        <MetricCard label={t("firstMovements")} value={dashboard.totalFirstMovements} />
        <MetricCard label={t("dashboardViews")} value={dashboard.totalDashboardViews} />
        <MetricCard label={t("salesCreated")} value={dashboard.totalSalesCreated} />
        <MetricCard label={t("movementsCreated")} value={dashboard.totalMovementsCreated} />
        <MetricCard label={t("transfersCreated")} value={dashboard.totalTransfersCreated} />
        <MetricCard
          label={t("creditsReceivedCreated")}
          value={dashboard.totalCreditReceivedCreated}
        />
        <MetricCard
          label={t("creditsGrantedCreated")}
          value={dashboard.totalCreditGrantedCreated}
        />
        <MetricCard label={t("payablesCreated")} value={dashboard.totalPayablesCreated} />
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold">{t("derivedMetrics")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label={t("activationRate")}
          value={cohortValue(
            dashboard.activatedWorkspaces,
            dashboard.activationEligibleWorkspaces,
            dashboard.activationRate,
          )}
          description={t("activationRateDesc")}
        />
        <MetricCard
          label={t("retention7d")}
          value={cohortValue(
            dashboard.returned7dWorkspaces,
            dashboard.retention7dEligibleWorkspaces,
            dashboard.retention7d,
          )}
          description={t("retention7dDesc")}
        />
        <MetricCard
          label={t("retention30d")}
          value={cohortValue(
            dashboard.returned30dWorkspaces,
            dashboard.retention30dEligibleWorkspaces,
            dashboard.retention30d,
          )}
          description={t("retention30dDesc")}
        />
        <MetricCard
          label={t("activeWorkspaces7d")}
          value={dashboard.activeWorkspaces7d}
          description={t("activeWorkspaces7dDesc")}
        />
        <MetricCard
          label={t("activeWorkspaces30d")}
          value={dashboard.activeWorkspaces30d}
          description={t("activeWorkspaces30dDesc")}
        />
        <MetricCard
          label={t("activePersonalWorkspaces30d")}
          value={dashboard.activePersonalWorkspaces30d}
          description={t("contextActivityDesc")}
        />
        <MetricCard
          label={t("activeBusinessWorkspaces30d")}
          value={dashboard.activeBusinessWorkspaces30d}
          description={t("contextActivityDesc")}
        />
        <MetricCard
          label={t("avgMovements")}
          value={dashboard.avgMovementsPerUser}
          description={t("avgMovementsDesc")}
        />
      </div>

      <h2 className="mt-8 mb-2 text-lg font-semibold">{t("featureUsageTitle")}</h2>
      <p className="mb-4 text-sm text-surface-muted">{t("featureUsageDesc")}</p>
      <TableShell>
        <Table>
          <THead>
            <tr>
              <Th>{t("featureColumn")}</Th>
              <Th align="right">{t("actions30dColumn")}</Th>
              <Th align="right">{t("workspaces30dColumn")}</Th>
            </tr>
          </THead>
          <TBody>
            {featureRows.map(([feature, labelKey]) => {
              const usage = usageByFeature.get(feature);
              return (
                <tr key={feature}>
                  <Td className="text-sm">{t(labelKey)}</Td>
                  <Td align="right" className="text-sm tabular-nums">
                    {usage?.events ?? 0}
                  </Td>
                  <Td align="right" className="text-sm tabular-nums">
                    {usage?.workspaces ?? 0}
                  </Td>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </TableShell>
    </main>
  );
}

function cohortValue(numerator: number, denominator: number, percentage: number | null): string {
  return `${numerator}/${denominator} · ${percentage === null ? "—" : `${percentage}%`}`;
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border bg-surface-card p-4 shadow-sm">
      <p className="text-sm text-surface-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {description && <p className="mt-1 text-xs text-surface-muted">{description}</p>}
    </div>
  );
}
