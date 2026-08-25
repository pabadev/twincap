'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';
import { Logo } from '@/components/ui/logo';

export function Footer() {
  const t = useT('Landing');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <Logo variant="logotipo" size="sm" />
          <nav className="flex gap-6">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 hover:text-primary dark:text-zinc-400 dark:hover:text-primary"
            >
              {t('login')}
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-zinc-600 hover:text-primary dark:text-zinc-400 dark:hover:text-primary"
            >
              {t('register')}
            </Link>
          </nav>
        </div>
        <div className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-500">
          {t('footerCopyright', { year: String(year) })}
        </div>
      </div>
    </footer>
  );
}
