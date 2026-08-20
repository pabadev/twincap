'use client';

import { useT } from '@/i18n/client';
import { Icon } from '@/components/ui/icon';
import { Check } from 'lucide-react';

export function Benefits() {
  const t = useT('Landing');

  return (
    <section className="bg-zinc-50 py-20 dark:bg-zinc-900 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          {t('benefitsTitle')}
        </h2>
        <ul className="mt-12 space-y-6">
          {(['benefit1', 'benefit2', 'benefit3'] as const).map((key) => (
            <li key={key} className="flex items-start gap-4">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600">
                <Icon icon={Check} size="sm" className="text-white" />
              </div>
              <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
                {t(key)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
