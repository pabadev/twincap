import Link from 'next/link';
import { getT } from '@/i18n/server';
import { Logo } from '@/components/ui/logo';

const LEGAL_PAGES = [
  { href: '/privacy', key: 'privacyTitle' },
  { href: '/terms', key: 'termsTitle' },
  { href: '/cookies', key: 'cookiesTitle' },
  { href: '/data-policy', key: 'dataPolicyTitle' },
] as const;

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getT('Legal');

  return (
    <div className="flex min-h-screen flex-col bg-surface-bg dark:bg-zinc-950">
      <header className="border-b border-surface-border bg-surface-card dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link
            href="/"
            aria-label={t('backHome')}
            className="inline-flex items-center text-zinc-600 hover:text-primary dark:text-zinc-300 dark:hover:text-primary"
          >
            <Logo variant="logotipo" size="sm" />
          </Link>
          <nav
            aria-label={t('navAriaLabel')}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
          >
            {LEGAL_PAGES.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className="font-medium text-zinc-600 hover:text-primary dark:text-zinc-300 dark:hover:text-primary"
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-prose rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm sm:p-8 dark:border-zinc-700 dark:bg-zinc-900">
          {children}
        </div>
      </main>

      <footer className="border-t border-surface-border bg-surface-card py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 text-xs text-zinc-500 sm:flex-row sm:px-6 dark:text-zinc-400">
          <span>© {new Date().getFullYear()} TwinCap</span>
          <nav aria-label={t('navAriaLabel')} className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {LEGAL_PAGES.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className="hover:text-primary dark:hover:text-primary"
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
