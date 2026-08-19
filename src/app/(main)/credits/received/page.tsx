import { redirect } from 'next/navigation';
import { listAccounts } from '../../../../core/application/accounts';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { MongoCreditReceivedRepository } from '../../../../infrastructure/repositories/credit-received-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { CreditsReceivedList } from './credits-received-list';

export default async function CreditsReceivedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const creditRepo = new MongoCreditReceivedRepository();

  const [accounts, credits] = await Promise.all([
    listAccounts(user.userId, accountRepo),
    creditRepo.findByUserId(user.userId),
  ]);

  return (
    <CreditsReceivedList
      accounts={structuredClone(accounts)}
      credits={structuredClone(credits)}
    />
  );
}
