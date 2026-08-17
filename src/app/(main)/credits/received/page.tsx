import { redirect } from 'next/navigation';
import { listAccounts } from '../../../../core/application/accounts';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { MongoCreditReceivedRepository } from '../../../../infrastructure/repositories/credit-received-repository';
import { CreditsReceivedList } from './credits-received-list';

const accountRepo = new MongoAccountRepository();
const creditRepo = new MongoCreditReceivedRepository();

export default async function CreditsReceivedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [accounts, credits] = await Promise.all([
    listAccounts(user.userId, accountRepo),
    creditRepo.findByUserId(user.userId),
  ]);

  return (
    <CreditsReceivedList
      accounts={accounts}
      credits={credits}
    />
  );
}
