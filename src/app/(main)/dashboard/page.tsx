import { redirect } from 'next/navigation';
import { getT, getLocale } from '../../../i18n/server';
import { listAccounts } from '../../../core/application/accounts';
import { computeDashboardSummary } from '../../../core/application/compute-dashboard-summary';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { MongoCreditReceivedRepository } from '../../../infrastructure/repositories/credit-received-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { Card } from '../../../components/ui';
import { SummaryCards } from '../../../components/dashboard/summary-cards';
import { MonthlyChart } from '../../../components/dashboard/monthly-chart';
import {
  RecentMovements,
  type SerializedMovement,
} from '../../../components/dashboard/recent-movements';
import { CURRENCY_EXPONENTS, type Currency } from '../../../core/domain/currency';

export const dynamic = 'force-dynamic';

function formatBalance(amount: number, currency: string, locale: string): string {
  const exponent = (CURRENCY_EXPONENTS as Record<string, number>)[currency] ?? 2;
  const value = amount / Math.pow(10, exponent);
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value);
  return formatted;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getT('Dashboard');
  const locale = await getLocale();

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const categoryRepo = new MongoCategoryRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();

  // Round 1: accounts (user identity comes from the session claims — P5).
  const accounts = await listAccounts(user.userId, accountRepo);

  // Round 2: depends on accounts + remaining independent queries in parallel
  const [balances, allMovements, categories, creditsReceived] = await Promise.all([
    Promise.all(
      accounts.map((account) =>
        movementRepo.aggregateBalance(user.userId, account.id),
      ),
    ),
    movementRepo.findByUserId(user.userId),
    categoryRepo.findByUserId(user.userId),
    creditReceivedRepo.findByUserId(user.userId),
  ]);

  const accountBalances = accounts.map((account, i) => ({
    ...account,
    balance: balances[i],
  }));

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const primaryCurrency: Currency =
    accounts.length > 0 ? accounts[0].currency : 'COP';

  const totalBalance = accountBalances
    .filter((a) => a.currency === primaryCurrency)
    .reduce((sum, a) => sum + a.balance, 0);

  // D2: internal transfers (both legs) and opening balances are NOT economic
  // result — excluded inside the use case.
  const { monthlyIncome, monthlyExpenses, months: monthlyData } =
    computeDashboardSummary({
      movements: allMovements,
      currency: primaryCurrency,
    });

  const pendingCredits = creditsReceived
    .filter((c) => c.principal.currency === primaryCurrency)
    .reduce((sum, c) => sum + c.pending, 0);

  const recentMovements: SerializedMovement[] = allMovements
    .slice(0, 5)
    .map((m) => ({
      id: m.id,
      type: m.type,
      amount: m.amount.amount,
      currency: m.amount.currency,
      date: m.date.toISOString(),
      categoryName: categoryMap.get(m.categoryId) ?? '',
    }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('welcomeBack')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {user.email ?? user.userId}
        </p>
      </div>

      <SummaryCards
        totalBalance={totalBalance}
        currency={primaryCurrency}
        monthlyIncome={monthlyIncome}
        monthlyExpenses={monthlyExpenses}
        pendingCredits={pendingCredits}
        locale={locale}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MonthlyChart
          data={monthlyData}
          currency={primaryCurrency}
          locale={locale}
        />
        <RecentMovements
          movements={recentMovements}
          noMovementsMessage={t('noMovements')}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {t('accounts')}
        </h2>

        {accountBalances.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t('noAccounts')}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accountBalances.map((account) => (
              <Card key={account.id} title={account.name}>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    {account.currency}
                  </span>
                  <span className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {formatBalance(account.balance, account.currency, locale)}
                  </span>
                  {account.isFixed && (
                    <span className="mt-1 inline-block w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {t('fixed')}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
