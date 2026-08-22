'use client';

import { useState, useEffect, useMemo } from 'react';
import { useT } from '../../../i18n/client';
import { DeleteClientButton } from './delete-client-button';
import { Icon } from '../../../components/ui/icon';
import { Search } from 'lucide-react';

export interface SerializedClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  note: string;
}

export function ClientsList({ clients }: { clients: SerializedClient[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const t = useT('Clients');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredClients = useMemo(() => {
    if (!debouncedQuery.trim()) return clients;
    const query = debouncedQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query),
    );
  }, [clients, debouncedQuery]);

  return (
    <>
      {clients.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Icon icon={Search} size="sm" className="text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {debouncedQuery.trim()
              ? filteredClients.length > 0
                ? t('showingResults', { filtered: String(filteredClients.length), total: String(clients.length) })
                : t('noResults')
              : t('showingResults', { filtered: String(clients.length), total: String(clients.length) })}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full min-w-[500px] divide-y divide-zinc-200 dark:divide-zinc-700">
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
            {filteredClients.map((client) => (
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
    </>
  );
}
