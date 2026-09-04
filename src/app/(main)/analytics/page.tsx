import { getAnalyticsDashboardAction } from './actions';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { DefaultAnalyticsAuthorizer } from '../../../infrastructure/auth/analytics-authorizer';
import { notFound, redirect } from 'next/navigation';

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
  if (!user) redirect('/login');

  const authorizer = new DefaultAnalyticsAuthorizer();
  const allowed = await authorizer.canView(user.userId, user.email ?? '');
  if (!allowed) notFound();

  const dashboard = await getAnalyticsDashboardAction();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Analytics Dashboard</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Product metrics for the closed beta — no PII tracked.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Registered" value={dashboard.totalRegistered} />
        <MetricCard label="Logged In" value={dashboard.totalLoggedIn} />
        <MetricCard label="Accounts Created" value={dashboard.totalAccountsCreated} />
        <MetricCard label="First Movements" value={dashboard.totalFirstMovements} />
        <MetricCard label="Dashboard Views" value={dashboard.totalDashboardViews} />
        <MetricCard label="Sales Created" value={dashboard.totalSalesCreated} />
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold">Derived Metrics</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Activation Rate" value={`${dashboard.activationRate}%`} description="≥3 movements in first 2 days" />
        <MetricCard label="Retention 7d" value={`${dashboard.retention7d}%`} description="Active in last 7 days" />
        <MetricCard label="Retention 30d" value={`${dashboard.retention30d}%`} description="Active in last 30 days" />
        <MetricCard label="Avg Movements/User" value={dashboard.avgMovementsPerUser} description="Per registered workspace" />
      </div>
    </main>
  );
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
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
