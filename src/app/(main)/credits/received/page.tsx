import { redirect } from 'next/navigation';
import { listAccounts } from '../../../../core/application/accounts';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { MongoCreditReceivedRepository } from '../../../../infrastructure/repositories/credit-received-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { serializeEntities } from '@/lib/serialize';
import { CreditsReceivedList } from './credits-received-list';

export default async function CreditsReceivedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const creditRepo = new MongoCreditReceivedRepository();

  const [accounts, credits] = await Promise.all([
    listAccounts(user.workspaceId!, accountRepo),
    creditRepo.findByWorkspaceId(user.workspaceId!),
  ]);

  return (
    <CreditsReceivedList
      accounts={serializeEntities(accounts)}
      credits={serializeEntities(credits)}
    />
  );
}
