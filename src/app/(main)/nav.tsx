'use client';

import { useState } from 'react';
import { useT, useLocale } from '../../i18n/client';
import { usePathname } from 'next/navigation';
import { logoutAction } from '../(auth)/actions';

const NAV_ITEMS = [
  { href: '/', key: 'dashboard' },
  { href: '/accounts', key: 'accounts' },
  { href: '/categories', key: 'categories' },
  { href: '/movements', key: 'movements' },
  { href: '/transfers', key: 'transfers' },
  { href: '/credits/received', key: 'creditsReceived' },
  { href: '/credits/granted', key: 'creditsGranted' },
  { href: '/pos/catalog', key: 'posCatalog' },
  { href: '/pos/sales', key: 'posSales' },
] as const;

export function MainNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const t = useT('Nav');
  const tCommon = useT('Common');
  const locale = useLocale();
  const pathname = usePathname();

  function toggleLocale() {
    const next = locale === 'es' ? 'en' : 'es';
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    window.location.reload();
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 rounded-md bg-zinc-200 p-2 text-zinc-700 hover:bg-zinc-300 lg:hidden dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        aria-label={open ? tCommon('closeMenu') : tCommon('openMenu')}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          {open ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-md transition-transform duration-200 ease-in-out dark:bg-zinc-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:shadow-none`}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-700">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white">
              GlobalMoney
            </h1>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
                      }`}
                    >
                      {t(item.key)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User info + language toggle + logout */}
          <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
            <p className="mb-3 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {email}
            </p>
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={toggleLocale}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {locale === 'es' ? 'EN' : 'ES'}
              </button>
              <form action={logoutAction} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {t('logout')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
