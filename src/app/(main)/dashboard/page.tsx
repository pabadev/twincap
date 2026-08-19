import { redirect } from 'next/navigation';
import { getT, getLocale } from '../../../i18n/server';
import { listAccounts } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
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
import type { Movement } from '../../../core/domain/movement';
import { CURRENCY_EXPONENTS, type Currency } from '../../../core/domain/currency';

export const dynamic = 'force-dynamic';

interface MonthData {
  month: string;
  income: number;
  expenses: number;
}

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

function computeMonthlyData(movements: Movement[], currency: string): MonthData[] {
  const now = new Date();
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  // Single pass: bucket movements by month
  for (const m of movements) {
    if (m.amount.currency !== currency) continue;
    const md = new Date(m.date);
    const key = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    if (m.type === 'income') bucket.income += m.amount.amount;
    else bucket.expenses += m.amount.amount;
    monthlyMap.set(key, bucket);
  }

  // Build ordered array for last 6 months
  const months: MonthData[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    months.push({ month: key, ...bucket });
  }
  return months;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getT('Dashboard');
  const locale = await getLocale();

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const userRepo = new MongoUserRepository();
  const categoryRepo = new MongoCategoryRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();

  // Round 1: independent queries in parallel
  const [dbUser, accounts] = await Promise.all([
    userRepo.findById(user.userId),
    listAccounts(user.userId, accountRepo),
  ]);

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

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const primaryCurrency: Currency =
    accounts.length > 0 ? accounts[0].currency : 'COP';

  const totalBalance = accountBalances
    .filter((a) => a.currency === primaryCurrency)
    .reduce((sum, a) => sum + a.balance, 0);

  const monthlyIncome = allMovements
    .filter(
      (m) =>
        m.type === 'income' &&
        m.amount.currency === primaryCurrency &&
        new Date(m.date) >= thisMonthStart,
    )
    .reduce((sum, m) => sum + m.amount.amount, 0);

  const monthlyExpenses = allMovements
    .filter(
      (m) =>
        m.type === 'expense' &&
        m.amount.currency === primaryCurrency &&
        new Date(m.date) >= thisMonthStart,
    )
    .reduce((sum, m) => sum + m.amount.amount, 0);

  const pendingCredits = creditsReceived
    .filter((c) => c.principal.currency === primaryCurrency)
    .reduce((sum, c) => sum + c.pending, 0);

  const monthlyData = computeMonthlyData(allMovements, primaryCurrency);

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
          {dbUser?.email ?? 'User'}
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
