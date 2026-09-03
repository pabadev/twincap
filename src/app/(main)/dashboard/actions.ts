'use server';

import { redirect } from 'next/navigation';
import { getT, getLocale } from '../../../i18n/server';
import { listAccounts } from '../../../core/application/accounts';
import { filterMovementsWithLiveParents, accountBalancesFromMovements } from '../../../core/application/movements';
import { buildDashboardSnapshot } from '../../../core/application/dashboard/build-dashboard-snapshot';
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

/**
 * Server action that re-aggregates the dashboard snapshot for a given filter
 * set. The client calls this on every filter change instead of re-filtering
 * and re-aggregating the full movement list in memory — only the aggregate
 * snapshot is sent back across the boundary.
 */
export async function getDashboardSnapshotAction(
  filters: DashboardFilters,
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

    const [allMovements, categories, creditsReceived, creditsGranted, payables, sales, transfers] =
      await Promise.all([
        movementRepo.findByWorkspaceId(user.workspaceId!),
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

    const liveMovements = filterMovementsWithLiveParents(allMovements, liveParents);
    const balanceByAccount = accountBalancesFromMovements(accounts, liveMovements);

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

    return buildDashboardSnapshot({
      accounts: accountBalancesWithBalance,
      categories: serializedCategories,
      movements: liveMovements,
      filters,
      locale,
      primaryCurrency,
      resolveCategoryLabel,
    });
  } catch (error) {
    // Report the unexpected crash (fail-safe, never re-raises), then preserve
    // the original behavior: let the exception propagate to the client's
    // generic error surface (the action previously had no try/catch).
    await reportUnexpectedErrorAndWait(error);
    throw error;
  }
}
