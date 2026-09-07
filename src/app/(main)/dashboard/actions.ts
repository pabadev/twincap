'use server';

import { redirect } from 'next/navigation';
import { getT, getLocale } from '../../../i18n/server';
import { listAccounts } from '../../../core/application/accounts';
import { filterMovementsWithLiveParents, accountBalancesFromMovements } from '../../../core/application/movements';
import { buildDashboardSnapshot } from '../../../core/application/dashboard/build-dashboard-snapshot';
import { computeDashboardWindow } from '../../../core/application/dashboard/compute-dashboard-window';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { MongoCreditReceivedRepository } from '../../../infrastructure/repositories/credit-received-repository';
import { MongoCreditGrantedRepository } from '../../../infrastructure/repositories/credit-granted-repository';
import { MongoPayableRepository } from '../../../infrastructure/repositories/payable-repository';
import { MongoSaleRepository } from '../../../infrastructure/repositories/sale-repository';
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import type { DashboardFilters } from '../../../components/dashboard/dashboard-filters';
import type { DashboardSnapshot } from '../../../components/dashboard/dashboard-snapshot';
import { makeCategoryLabelResolver } from '../../../lib/resolve-category-label';
import { SYSTEM_NOTES_NAMESPACE } from '../../../lib/system-note';
import { reportUnexpectedErrorAndWait } from '../../../lib/report-unexpected-error';
import { trackAnalytics } from '../../../lib/track-analytics';

/**
 * Server action that re-aggregates the dashboard snapshot for a given filter
 * set. The client calls this on every filter change instead of re-filtering
 * and re-aggregating the full movement list in memory — only the aggregate
 * snapshot is sent back across the boundary.
 */
export async function getDashboardSnapshotAction(
  filters: DashboardFilters,
  tzOffsetMinutes = 0,
): Promise<DashboardSnapshot> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  try {
    await connectDb();

    const accountRepo = new MongoAccountRepository();
    const movementRepo = new MongoMovementRepository();
    const categoryRepo = new MongoCategoryRepository();
    const creditReceivedRepo = new MongoCreditReceivedRepository();
    const creditGrantedRepo = new MongoCreditGrantedRepository();
    const payableRepo = new MongoPayableRepository();
    const saleRepo = new MongoSaleRepository();
    const transferRepo = new MongoTransferRepository();

    const accounts = await listAccounts(user.workspaceId!, accountRepo);

    // R14-I: same civil-clock basis as buildDashboardSnapshot below — the
    // tzOffsetMinutes the client already sends. Snapshot reads the union
    // window; balances keep reading FULL history (R7-A, identical numbers).
    const { from, to } = computeDashboardWindow(new Date(), tzOffsetMinutes);

    const [windowedMovements, balanceMovements, categories, creditsReceived, creditsGranted, payables, sales, transfers] =
      await Promise.all([
        movementRepo.findByWorkspaceIdAndDateRange(user.workspaceId!, from, to),
        movementRepo.findByWorkspaceIdForBalance(user.workspaceId!),
        categoryRepo.findByWorkspaceId(user.workspaceId!),
        creditReceivedRepo.findByWorkspaceId(user.workspaceId!),
        creditGrantedRepo.findByWorkspaceId(user.workspaceId!),
        payableRepo.findByWorkspaceId(user.workspaceId!),
        saleRepo.findByWorkspaceId(user.workspaceId!),
        transferRepo.findByWorkspaceId(user.workspaceId!),
      ]);

    // R6-P1 defensive filter + R7-A balance derivation — same source/pattern as page.tsx.
    const liveParents = {
      accounts: new Set(accounts.map((a) => a.id)),
      transfers: new Set(transfers.map((tr) => tr.id)),
      creditsReceived: creditsReceived.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        date: c.date,
        amount: c.principal.amount,
      })),
      creditsGranted: creditsGranted.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        date: c.date,
        amount: c.principal.amount,
      })),
      sales: sales.map((s) => ({
        id: s.id,
        accountId: s.accountId,
        date: s.date,
        amount: s.total,
      })),
      payables: new Set(payables.map((p) => p.id)),
    };

    const liveMovements = filterMovementsWithLiveParents(windowedMovements, liveParents);
    // R7-A balances derive from the FULL live history (same filter, complete
    // read) — identical numbers to the pre-windowed dashboard.
    const liveBalanceMovements = filterMovementsWithLiveParents(balanceMovements, liveParents);
    const balanceByAccount = accountBalancesFromMovements(accounts, liveBalanceMovements);

    const accountBalancesWithBalance = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      isFixed: account.isFixed,
      balance: balanceByAccount.get(account.id) ?? 0,
    }));

    const serializedCategories = categories.map((c) => c.toJSON());

    const primaryCurrency =
      accounts.length > 0 ? accounts[0].currency : 'COP';

    const [tDashboard, tSystemNotes, locale] = await Promise.all([
      getT('Dashboard'),
      getT(SYSTEM_NOTES_NAMESPACE),
      getLocale(),
    ]);

    const resolveCategoryLabel = makeCategoryLabelResolver({
      categories: serializedCategories,
      tSystemNotes,
      tDashboard,
    });

    // R13-G: track dashboard view (analytics, best-effort).
    await trackAnalytics('dashboardViewed', user.workspaceId!, user.userId);

    return buildDashboardSnapshot({
      accounts: accountBalancesWithBalance,
      categories: serializedCategories,
      movements: liveMovements,
      filters,
      locale,
      primaryCurrency,
      resolveCategoryLabel,
      tzOffsetMinutes,
    });
  } catch (error) {
    // Report the unexpected crash (fail-safe, never re-raises), then preserve
    // the original behavior: let the exception propagate to the client's
    // generic error surface (the action previously had no try/catch).
    await reportUnexpectedErrorAndWait(error);
    throw error;
  }
}
