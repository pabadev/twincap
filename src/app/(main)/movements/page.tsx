import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { listMovements } from '../../../core/application/movements';
import { listCategories } from '../../../core/application/categories';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoMovementRepository } from '../../../infrastructure/repositories/movement-repository';
import { MongoCategoryRepository } from '../../../infrastructure/repositories/category-repository';
import { MovementsList } from './movements-list';

const accountRepo = new MongoAccountRepository();
const movementRepo = new MongoMovementRepository();
const categoryRepo = new MongoCategoryRepository();

export default async function MovementsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [accounts, categories] = await Promise.all([
    listAccounts(user.userId, accountRepo),
    listCategories(user.userId, categoryRepo),
  ]);

  // Fetch movements for all accounts
  const movementsByAccount = new Map<string, Awaited<ReturnType<typeof listMovements>>>();
  await Promise.all(
    accounts.map(async (account) => {
      const movements = await listMovements(user.userId, account.id, movementRepo);
      movementsByAccount.set(account.id, movements);
    }),
  );

  return (
    <MovementsList
      accounts={accounts}
      movementsByAccount={movementsByAccount}
      categories={categories}
    />
  );
}
