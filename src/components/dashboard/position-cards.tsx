'use client';

import { Card } from '../ui/card';
import { Icon } from '../ui/icon';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { useT } from '../../i18n/client';
import { formatAmount } from '../../lib/format';

interface CurrencyPosition {
  currency: string;
  activos: number;
  pasivos: number;
  net: number;
}

interface PositionCardsProps {
  positions: CurrencyPosition[];
  locale: string;
}

export function PositionCards({ positions, locale }: PositionCardsProps) {
  const t = useT('Dashboard');

  if (positions.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t('position')}
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t('noPositionData')}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
        {t('position')}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((pos) => (
          <Card key={pos.currency} className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {pos.currency}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="rounded bg-income/10 p-1">
                  <Icon icon={TrendingUp} size="sm" className="text-income" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('activos')}</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatAmount(pos.activos, pos.currency, locale)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded bg-expense/10 p-1">
                  <Icon icon={TrendingDown} size="sm" className="text-expense" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('pasivos')}</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatAmount(pos.pasivos, pos.currency, locale)}
                  </p>
                </div>
              </div>
              <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="rounded bg-info/10 p-1">
                    <Icon icon={Scale} size="sm" className="text-info" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('netPosition')}</p>
                    <p
                      className={`text-sm font-semibold ${
                        pos.net >= 0
                          ? 'text-income'
                          : 'text-expense'
                      }`}
                    >
                      {pos.net >= 0 ? '+' : ''}
                      {formatAmount(pos.net, pos.currency, locale)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
