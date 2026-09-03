import Link from 'next/link';
import { getT } from '@/i18n/server';
import { Logo } from '@/components/ui/logo';

const SUPPORT_EMAIL = 'soporte@twincap.app';

const FAQ_ITEMS = [
  { qKey: 'faqAccountsQ', aKey: 'faqAccountsA' },
  { qKey: 'faqTransferQ', aKey: 'faqTransferA' },
  { qKey: 'faqCreditQ', aKey: 'faqCreditA' },
  { qKey: 'faqSalesQ', aKey: 'faqSalesA' },
  { qKey: 'faqSecurityQ', aKey: 'faqSecurityA' },
] as const;

const FOOTER_LINKS = [
  { href: '/privacy', labelKey: 'privacy' },
  { href: '/terms', labelKey: 'terms' },
  { href: '/cookies', labelKey: 'cookies' },
  { href: '/data-policy', labelKey: 'dataPolicy' },
] as const;

export default async function HelpPage() {
  const tHelp = await getT('Help');
  const tLanding = await getT('Landing');

  return (
    <div className="flex min-h-screen flex-col bg-surface-bg dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-surface-border bg-surface-card dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link
            href="/"
            aria-label={tHelp('backHome')}
            className="inline-flex items-center text-zinc-600 hover:text-primary dark:text-zinc-300 dark:hover:text-primary"
          >
            <Logo variant="logotipo" size="sm" />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-prose rounded-lg border border-surface-border bg-surface-card p-6 shadow-sm sm:p-8 dark:border-zinc-700 dark:bg-zinc-900">
          {/* Title */}
          <header className="mb-8 border-b border-surface-border pb-6 dark:border-zinc-700">
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-white">
              {tHelp('title')}
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {tHelp('subtitle')}
            </p>
          </header>

          {/* FAQ */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {tHelp('faqTitle')}
            </h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map(({ qKey, aKey }) => (
                <details
                  key={qKey}
                  className="group rounded-md border border-zinc-200 dark:border-zinc-700"
                >
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:text-white dark:hover:bg-zinc-800 [&::-webkit-details-marker]:hidden">
                    {tHelp(qKey)}
                  </summary>
                  <div className="border-t border-zinc-200 px-4 py-3 text-sm leading-relaxed text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                    {tHelp(aKey)}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Contact support */}
          <section className="mt-8 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {tHelp('contactTitle')}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {tHelp('contactBody')}
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:text-primary-hover dark:text-primary"
            >
              {tHelp('contactButton')} — {SUPPORT_EMAIL}
            </a>
          </section>

          {/* Back to home */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              {tHelp('backHome')}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border bg-surface-card py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 px-4 text-xs text-zinc-500 sm:flex-row sm:px-6 dark:text-zinc-400">
          <span>© {new Date().getFullYear()} TwinCap</span>
          <nav aria-label={tLanding('legalNavAriaLabel')} className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {FOOTER_LINKS.map(({ href, labelKey }) => (
              <Link
                key={href}
                href={href}
                className="hover:text-primary dark:hover:text-primary"
              >
                {tLanding(labelKey)}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
