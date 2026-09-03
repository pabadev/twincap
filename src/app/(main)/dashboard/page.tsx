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
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { DashboardContent } from '../../../components/dashboard/dashboard-content';
import { computeActivosPasivos } from '../../../core/application/compute-activos-pasivos';
import type { DashboardFilters } from '../../../components/dashboard/dashboard-filters';
import { makeCategoryLabelResolver } from '../../../lib/resolve-category-label';
import { SYSTEM_NOTES_NAMESPACE } from '../../../lib/system-note';

export const dynamic = 'force-dynamic';

const DEFAULT_FILTERS: DashboardFilters = {
  scope: 'all',
  accountId: 'all',
  categoryId: 'all',
  period: 'current_month',
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getT('Dashboard');
  const locale = await getLocale();

  await connectDb();
  const userRepo = new MongoUserRepository();
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const categoryRepo = new MongoCategoryRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();
  const creditGrantedRepo = new MongoCreditGrantedRepository();
  const payableRepo = new MongoPayableRepository();
  const saleRepo = new MongoSaleRepository();
  const transferRepo = new MongoTransferRepository();

  const [userEntity, accounts] = await Promise.all([
    userRepo.findById(user.userId),
    listAccounts(user.workspaceId!, accountRepo),
  ]);

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

  // R6-P1: defensive filter — drop movements whose linked parent is gone
  // (orphans from a deletion that failed to cascade must not reach the
  // dashboard or its aggregations). See page.tsx history for details.
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
  const serializedCategories = categories.map((c) => c.toJSON());

  // R7-A: derive each account's balance from the LIVE (parent-filtered)
  // movements instead of aggregateBalance.
  const balanceByAccount = accountBalancesFromMovements(accounts, liveMovements);

  const accountBalances = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    isFixed: account.isFixed,
    balance: balanceByAccount.get(account.id) ?? 0,
  }));

  const primaryCurrency =
    accounts.length > 0 ? accounts[0].currency : 'COP';

  const positionData = computeActivosPasivos({
    accounts: accountBalances,
    creditsGranted: creditsGranted.map((c) => ({
      principal: { currency: c.principal.currency },
      pending: c.pending,
      writtenOff: Boolean(c.writtenOff),
    })),
    creditsReceived,
    payables,
  });

  const tSystemNotes = await getT(SYSTEM_NOTES_NAMESPACE);
  const resolveCategoryLabel = makeCategoryLabelResolver({
    categories: serializedCategories,
    tSystemNotes,
    tDashboard: t,
  });

  const initialSnapshot = buildDashboardSnapshot({
    accounts: accountBalances,
    categories: serializedCategories,
    movements: liveMovements,
    filters: DEFAULT_FILTERS,
    locale,
    primaryCurrency,
    resolveCategoryLabel,
  });

  return (
    <DashboardContent
      accounts={accountBalances}
      categories={serializedCategories}
      primaryCurrency={primaryCurrency}
      locale={locale}
      userLabel={t('welcomeBack')}
      userName={userEntity?.name}
      noAccountsMessage={t('noAccounts')}
      noMovementsMessage={t('noMovements')}
      positionData={positionData.positions}
      initialSnapshot={initialSnapshot}
    />
  );
}
