import Link from 'next/link';
import { getT } from '@/i18n/server';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getT('Auth');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-bg px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-lg bg-surface-card p-8 shadow-md dark:bg-zinc-900">
        {children}
      </div>
      <nav
        aria-label={t('legalNavAriaLabel')}
        className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
      >
        <Link
          href="/privacy"
          className="text-xs text-zinc-500 hover:text-primary dark:text-zinc-400 dark:hover:text-primary"
        >
          {t('privacy')}
        </Link>
        <Link
          href="/terms"
          className="text-xs text-zinc-500 hover:text-primary dark:text-zinc-400 dark:hover:text-primary"
        >
          {t('terms')}
        </Link>
        <Link
          href="/cookies"
          className="text-xs text-zinc-500 hover:text-primary dark:text-zinc-400 dark:hover:text-primary"
        >
          {t('cookies')}
        </Link>
        <Link
          href="/data-policy"
          className="text-xs text-zinc-500 hover:text-primary dark:text-zinc-400 dark:hover:text-primary"
        >
          {t('dataPolicy')}
        </Link>
      </nav>
    </div>
  );
}
