import { redirect } from 'next/navigation';
import { getT } from '../../../i18n/server';
import { listAccounts } from '../../../core/application/accounts';
import { getUserBalances } from '../../../core/application/balance';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { CURRENCY_EXPONENTS } from '../../../core/domain/currency';
import { AccountsPageClient } from './accounts-page-client';
import { DeleteAccountButton } from './delete-account-button';
import { Wallet } from 'lucide-react';

function formatBalance(amount: number, currency: string): string {
  const exp = CURRENCY_EXPONENTS[currency as keyof typeof CURRENCY_EXPONENTS] ?? 0;
  const divisor = 10 ** exp;
  const value = amount / divisor;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  });
}

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getT('Accounts');

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();

  const [accounts, balances] = await Promise.all([
    listAccounts(user.userId, accountRepo),
    getUserBalances(user.userId, movementRepo),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <AccountsPageClient />
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 text-zinc-400">
            <Wallet size={48} strokeWidth={1} />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t('emptyTitle')}</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('emptyDescription')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="w-full min-w-[400px] divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('name')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('balance')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {accounts.map((account) => {
                const balance = balances.get(account.id) ?? 0;
                return (
                  <tr key={account.id}>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {account.name}
                      </span>
                      {account.isFixed && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {t('fixed')}
                        </span>
                      )}
                      <span className="ml-2 text-xs text-zinc-400">
                        {account.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-medium ${
                          balance >= 0
                            ? 'text-income'
                            : 'text-expense'
                        }`}
                      >
                        {formatBalance(balance, account.currency)}{' '}
                        {account.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!account.isFixed && (
                        <DeleteAccountButton accountId={account.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
