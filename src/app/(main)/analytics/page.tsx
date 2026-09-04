import { getAnalyticsDashboardAction } from './actions';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { redirect } from 'next/navigation';

/**
 * Product analytics dashboard page (R13-G).
 *
 * Displays activation, retention, and usage metrics for the closed beta.
 * No PII is shown — only workspace-scoped aggregate counts and percentages.
 * Accessible to any logged-in user during the beta (small closed group).
 */
export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

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
