'use client';

import { useT } from '../../i18n/client';
import { ReportCard } from './report-card';
import { ArrowLeftRight, Landmark, List, CreditCard, Receipt, ShoppingCart } from 'lucide-react';

export function DashboardReportsGrid() {
  const t = useT('Dashboard');

  const reports = [
    { href: '/movements', icon: List, label: t('reportMovements') },
    { href: '/transfers', icon: ArrowLeftRight, label: t('reportTransfers') },
    { href: '/credits/received', icon: CreditCard, label: t('reportCreditsReceived') },
    { href: '/credits/granted', icon: Landmark, label: t('reportCreditsGranted') },
    { href: '/payables', icon: Receipt, label: t('reportPayables') },
    { href: '/pos/sales', icon: ShoppingCart, label: t('reportSales') },
  ];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        {t('reports')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {reports.map((report) => (
          <ReportCard key={report.href} {...report} />
        ))}
      </div>
    </div>
  );
}
