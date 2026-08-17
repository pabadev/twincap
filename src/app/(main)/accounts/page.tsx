import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { getUserBalances } from '../../../core/application/balance';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { CURRENCY_EXPONENTS } from '../../../core/domain/currency';
import { AccountForm } from './account-form';
import { DeleteAccountButton } from './delete-account-button';

const accountRepo = new MongoAccountRepository();
const movementRepo = new MongoMovementRepository();

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

  const [accounts, balances] = await Promise.all([
    listAccounts(user.userId, accountRepo),
    getUserBalances(user.userId, movementRepo),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Accounts
        </h1>
      </div>

      {accounts.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">
          No accounts yet. Create your first account below.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Balance
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Actions
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
                          Fixed
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
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
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

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Add Account
        </h2>
        <AccountForm />
      </div>
    </div>
  );
}
