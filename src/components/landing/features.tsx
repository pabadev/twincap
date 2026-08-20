'use client';

import { useT } from '@/i18n/client';
import { Icon } from '@/components/ui/icon';
import { Wallet, TrendingUp, Shield, Users, BarChart3, Zap } from 'lucide-react';

const FEATURES = [
  { key: 'feature1', icon: Wallet },
  { key: 'feature2', icon: TrendingUp },
  { key: 'feature3', icon: Shield },
  { key: 'feature4', icon: Users },
  { key: 'feature5', icon: BarChart3 },
  { key: 'feature6', icon: Zap },
] as const;

export function Features() {
  const t = useT('Landing');

  return (
    <section className="bg-white py-20 dark:bg-zinc-950 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
            {t('featuresTitle')}
          </h2>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon }) => (
            <div
              key={key}
              className="group rounded-xl border border-zinc-200 bg-zinc-50 p-6 transition-all hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-600"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-900/30 dark:text-indigo-400 dark:group-hover:bg-indigo-600 dark:group-hover:text-white">
                <Icon icon={icon} size="lg" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {t(`${key}Title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`${key}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
