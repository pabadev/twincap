import { getAnalyticsDashboardAction } from './actions';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { DefaultAnalyticsAuthorizer } from '../../../infrastructure/auth/analytics-authorizer';
import { notFound, redirect } from 'next/navigation';
import { getT } from '@/i18n/server';

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
  const t = await getT('Analytics');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label={t('registered')} value={dashboard.totalRegistered} />
        <MetricCard label={t('loggedIn')} value={dashboard.totalLoggedIn} />
        <MetricCard label={t('accountsCreated')} value={dashboard.totalAccountsCreated} />
        <MetricCard label={t('firstMovements')} value={dashboard.totalFirstMovements} />
        <MetricCard label={t('dashboardViews')} value={dashboard.totalDashboardViews} />
        <MetricCard label={t('salesCreated')} value={dashboard.totalSalesCreated} />
        <MetricCard label={t('movementsCreated')} value={dashboard.totalMovementsCreated} />
        <MetricCard label={t('transfersCreated')} value={dashboard.totalTransfersCreated} />
        <MetricCard label={t('creditsReceivedCreated')} value={dashboard.totalCreditReceivedCreated} />
        <MetricCard label={t('creditsGrantedCreated')} value={dashboard.totalCreditGrantedCreated} />
        <MetricCard label={t('payablesCreated')} value={dashboard.totalPayablesCreated} />
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold">{t('derivedMetrics')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label={t('activationRate')} value={`${dashboard.activationRate}%`} description={t('activationRateDesc')} />
        <MetricCard label={t('retention7d')} value={`${dashboard.retention7d}%`} description={t('retention7dDesc')} />
        <MetricCard label={t('retention30d')} value={`${dashboard.retention30d}%`} description={t('retention30dDesc')} />
        <MetricCard label={t('avgMovements')} value={dashboard.avgMovementsPerUser} description={t('avgMovementsDesc')} />
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
