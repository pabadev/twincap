'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useT, useLocale } from '../../i18n/client';
import { usePathname } from 'next/navigation';
import { logoutAction } from '../(auth)/actions';
import { Languages, Menu, X } from 'lucide-react';
import { Logo } from '../../components/ui/logo';

const NAV_ITEMS = [
  { href: '/', key: 'dashboard' },
  { href: '/accounts', key: 'accounts' },
  { href: '/categories', key: 'categories' },
  { href: '/movements', key: 'movements' },
  { href: '/transfers', key: 'transfers' },
  { href: '/credits/received', key: 'creditsReceived' },
  { href: '/credits/granted', key: 'creditsGranted' },
  { href: '/clients', key: 'clients' },
  { href: '/pos/catalog', key: 'posCatalog' },
  { href: '/pos/sales', key: 'posSales' },
] as const;

export function MainNav({ isLoggedIn, email }: { isLoggedIn: boolean; email?: string }) {
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
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
            <Logo variant="logotipo" size="md" />
          </div>

          {isLoggedIn ? (
            <>
              {/* Nav links — authenticated */}
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <ul className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const isActive =
                      item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
                          }`}
                        >
                          {t(item.key)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* User info + language toggle + logout */}
              <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
                {email && (
                  <p className="mb-3 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {email}
                  </p>
                )}
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={toggleLocale}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label={tCommon('switchLang')}
                  >
                    <Languages className="h-4 w-4" />
                    <span className="hidden sm:inline">{locale === 'es' ? 'EN' : 'ES'}</span>
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
            </>
          ) : (
            /* Guest: language toggle + Login/Register */
            <div className="mt-auto border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {t('login')}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="block rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {t('register')}
                </Link>
                <button
                  type="button"
                  onClick={toggleLocale}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-label={tCommon('switchLang')}
                >
                  <Languages className="h-4 w-4" />
                  <span>{locale === 'es' ? 'EN' : 'ES'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
