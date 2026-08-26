import { redirect } from 'next/navigation';
import { getT, getLocale } from '../../../i18n/server';
import { listAccounts } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { MongoCreditReceivedRepository } from '../../../infrastructure/repositories/credit-received-repository';
import { MongoCreditGrantedRepository } from '../../../infrastructure/repositories/credit-granted-repository';
import { MongoPayableRepository } from '../../../infrastructure/repositories/payable-repository';
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

  const [userEntity, accounts] = await Promise.all([
    userRepo.findById(user.userId),
    listAccounts(user.userId, accountRepo),
  ]);

  const [balances, allMovements, categories, creditsReceived, creditsGranted, payables] =
    await Promise.all([
      Promise.all(
        accounts.map((account) =>
          movementRepo.aggregateBalance(user.userId, account.id),
        ),
      ),
      movementRepo.findByUserId(user.userId),
      categoryRepo.findByUserId(user.userId),
      creditReceivedRepo.findByUserId(user.userId),
      creditGrantedRepo.findByUserId(user.userId),
      payableRepo.findByUserId(user.userId),
    ]);

  const accountBalances = accounts.map((account, i) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    isFixed: account.isFixed,
    balance: balances[i],
  }));

  const primaryCurrency =
    accounts.length > 0 ? accounts[0].currency : 'COP';

  const positionData = computeActivosPasivos({
    accounts: accountBalances,
    creditsGranted,
    creditsReceived,
    payables,
  });

  const serializedMovements = allMovements.map((m) => m.toJSON());
  const serializedCategories = categories.map((c) => c.toJSON());

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
