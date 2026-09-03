import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoTransferRepository } from '../../../infrastructure/repositories/transfer-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { serializeEntities } from '@/lib/serialize';
import { TransfersList } from './transfers-list';

export default async function TransfersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const transferRepo = new MongoTransferRepository();

  const [accounts, transfers] = await Promise.all([
    listAccounts(user.workspaceId!, accountRepo),
    transferRepo.findByWorkspaceId(user.workspaceId!),
  ]);

  return (
    <TransfersList
      accounts={serializeEntities(accounts)}
      transfers={serializeEntities(transfers)}
    />
  );
}
