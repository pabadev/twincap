import { Users } from 'lucide-react';
import { getT } from '../../../i18n/server';
import { listClients } from '../../../core/application/clients';
import { getCurrentUser } from '../../../infrastructure/auth/getCurrentUser';
import { MongoClientRepository } from '../../../infrastructure/repositories/client-repository';
import { connectDb } from '../../../infrastructure/db/connection';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { ClientForm } from './client-form';
import { ClientsList, type SerializedClient } from './clients-list';

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) {
    // Redirect is handled by proxy, but we need to satisfy the type
    return null;
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
      </div>

      {serializedClients.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Users} size="xl" />}
          title={t('noClients')}
          description={t('emptyDescription')}
        />
      ) : (
        <ClientsList clients={serializedClients} />
      )}

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
          {t('newClient')}
        </h2>
        <ClientForm />
      </div>
    </div>
  );
}
