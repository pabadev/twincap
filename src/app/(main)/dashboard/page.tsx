import { redirect } from 'next/navigation';
import { getT, getLocale } from '../../../i18n/server';
import { listAccounts } from '../../../core/application/accounts';
import { filterMovementsWithLiveParents, accountBalancesFromMovements } from '../../../core/application/movements';
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

export const dynamic = 'force-dynamic';

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
    listAccounts(user.userId, accountRepo),
  ]);

  const [allMovements, categories, creditsReceived, creditsGranted, payables, sales, transfers] =
    await Promise.all([
      movementRepo.findByUserId(user.userId),
      categoryRepo.findByUserId(user.userId),
      creditReceivedRepo.findByUserId(user.userId),
      creditGrantedRepo.findByUserId(user.userId),
      payableRepo.findByUserId(user.userId),
      saleRepo.findByUserId(user.userId),
      transferRepo.findByUserId(user.userId),
    ]);

  // R6-P1: defensive filter — drop movements whose linked parent is gone
  // (orphans from a deletion that failed to cascade must not reach the
  // dashboard or its aggregations).
  // Kinds that may carry legacy UUID refIds get LinkableParent[] so the
  // filter can fall back to value-based reconciliation (accountId + date + amount).
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
  const serializedMovements = liveMovements.map((m) => m.toJSON());
  const serializedCategories = categories.map((c) => c.toJSON());

  // R7-A: derive each account's balance from the LIVE (parent-filtered)
  // movements instead of aggregateBalance (which sums every movement including
  // orphans). accountBalancesFromMovements sums signedAmount over liveMovements,
  // excluding orphan movements (deleted parents that failed to cascade), so the
  // Balance total and the Activos/Patrimonio cards no longer get inflated by
  // leftovers the movements table already hides via P1.
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
    creditsGranted,
    creditsReceived,
    payables,
  });

  return (
    <DashboardContent
      accounts={accountBalances}
      movements={serializedMovements}
      categories={serializedCategories}
      primaryCurrency={primaryCurrency}
      locale={locale}
      userLabel={t('welcomeBack')}
      userName={userEntity?.name}
      noAccountsMessage={t('noAccounts')}
      noMovementsMessage={t('noMovements')}
      positionData={positionData.positions}
    />
  );
}
