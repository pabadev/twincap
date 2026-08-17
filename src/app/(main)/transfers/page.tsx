import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { TransfersList } from './transfers-list';

const accountRepo = new MongoAccountRepository();
const transferRepo = new MongoTransferRepository();

export default async function TransfersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [accounts, transfers] = await Promise.all([
    listAccounts(user.userId, accountRepo),
    transferRepo.findByUserId(user.userId),
  ]);

  return (
    <TransfersList
      accounts={accounts}
      transfers={transfers}
    />
  );
}
