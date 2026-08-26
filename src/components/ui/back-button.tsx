'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../../i18n/client';
import { Icon } from './icon';

export function BackButton() {
  const router = useRouter();
  const t = useT('Common');

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors mb-4"
      aria-label={t('back')}
    >
      <Icon icon={ArrowLeft} size="sm" />
      <span>{t('back')}</span>
    </button>
  );
}
