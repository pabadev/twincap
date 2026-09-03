import { redirect } from 'next/navigation';
import { listAccounts } from '../../../core/application/accounts';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../infrastructure/repositories/account-repository';
import { MongoPayableRepository } from '../../../infrastructure/repositories/payable-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { serializeEntities } from '@/lib/serialize';
import { PayablesList } from './payables-list';

export default async function PayablesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const payableRepo = new MongoPayableRepository();

  const [accounts, payables] = await Promise.all([
    listAccounts(user.workspaceId!, accountRepo),
    payableRepo.findByWorkspaceId(user.workspaceId!),
  ]);

  return (
    <PayablesList
      accounts={serializeEntities(accounts)}
      payables={serializeEntities(payables)}
    />
  );
}
