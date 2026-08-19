'use client';

import type { Client } from '../../../core/domain/client';
import { useT } from '../../../i18n/client';
import { DeleteClientButton } from './delete-client-button';

export function ClientsList({ clients }: { clients: Client[] }) {
  const t = useT('Clients');

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('name')}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('phone')}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('email')}
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('delete')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {clients.map((client) => (
            <tr key={client.id}>
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {client.name}
                </span>
                {client.note && (
                  <span className="ml-2 text-xs text-zinc-400">
                    {client.note}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                {client.phone || '—'}
              </td>
              <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                {client.email || '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <DeleteClientButton clientId={client.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
