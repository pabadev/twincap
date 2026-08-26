import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { getT } from '../../../i18n/server';
import { listClients } from '../../../core/application/clients';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoClientRepository } from '../../../infrastructure/repositories/client-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { BackButton } from '../../../components/ui/back-button';
import { ClientsPageClient } from './clients-page-client';
import { ClientsList, type SerializedClient } from './clients-list';

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const t = await getT('Clients');

  await connectDb();
  const clientRepo = new MongoClientRepository();
  const clients = await listClients(user.userId, clientRepo);
  const serializedClients: SerializedClient[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    note: c.note,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackButton />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <ClientsPageClient />
      </div>

      {serializedClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 text-zinc-400">
            <Users size={48} strokeWidth={1} />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t('noClients')}</h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t('emptyDescription')}</p>
        </div>
      ) : (
        <ClientsList clients={serializedClients} />
      )}
    </div>
  );
}
