import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoUserRepository } from '../../../infrastructure/repositories/user-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { Card } from '../../../components/ui';

export const dynamic = 'force-dynamic';

function formatBalance(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'COP' ? 0 : 2,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(amount);
  return formatted;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const userRepo = new MongoUserRepository();

  const dbUser = await userRepo.findById(user.userId);
  const accounts = await listAccounts(user.userId, accountRepo);

  const balances = await Promise.all(
    accounts.map((account) =>
      movementRepo.aggregateBalance(user.userId, account.id),
    ),
  );

  const accountBalances = accounts.map((account, i) => ({
    ...account,
    balance: balances[i],
  }));

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {dbUser?.email ?? 'User'}
        </p>
      </div>

      {/* Accounts section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          Accounts
        </h2>

        {accountBalances.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              No accounts yet. Create your first account to get started.
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
                    {formatBalance(account.balance, account.currency)}
                  </span>
                  {account.isFixed && (
                    <span className="mt-1 inline-block w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Fixed
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
