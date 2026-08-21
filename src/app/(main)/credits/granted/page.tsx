import { redirect } from 'next/navigation';
import { listAccounts } from '../../../../core/application/accounts';
import { getCurrentUser } from '../../../../infrastructure/auth/getCurrentUser';
import { MongoAccountRepository } from '../../../../infrastructure/repositories/account-repository';
import { MongoCreditGrantedRepository } from '../../../../infrastructure/repositories/credit-granted-repository';
import { connectDb } from '../../../../infrastructure/db/connection';
import { serializeEntities } from '@/lib/serialize';
import { CreditsGrantedList } from './credits-granted-list';

export default async function CreditsGrantedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const creditRepo = new MongoCreditGrantedRepository();

  const [accounts, credits] = await Promise.all([
    listAccounts(user.userId, accountRepo),
    creditRepo.findByUserId(user.userId),
  ]);

  return (
    <CreditsGrantedList
      accounts={serializeEntities(accounts)}
      credits={serializeEntities(credits)}
    />
  );
}
