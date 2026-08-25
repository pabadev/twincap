'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT, useLocale } from '../../i18n/client';
import { usePathname } from 'next/navigation';
import { logoutAction } from '../(auth)/actions';
import { Languages, LogOut, Menu, X } from 'lucide-react';
import { Logo } from '../../components/ui/logo';
import { Button } from '../../components/ui/button';

const NAV_GROUPS = [
  {
    label: 'groupGeneral',
    items: [
      { href: '/dashboard', key: 'dashboard' },
    ],
  },
  {
    label: 'groupFinanzas',
    items: [
      { href: '/accounts', key: 'accounts' },
      { href: '/categories', key: 'categories' },
      { href: '/movements', key: 'movements' },
      { href: '/transfers', key: 'transfers' },
    ],
  },
  {
    label: 'groupCredito',
    items: [
      { href: '/credits/received', key: 'creditsReceived' },
      { href: '/credits/granted', key: 'creditsGranted' },
      { href: '/payables', key: 'payables' },
    ],
  },
  {
    label: 'groupNegocio',
    items: [
      { href: '/clients', key: 'clients' },
      { href: '/pos/catalog', key: 'posCatalog' },
      { href: '/pos/sales', key: 'posSales' },
    ],
  },
] as const;

export function MainNav({ isLoggedIn, email }: { isLoggedIn: boolean; email?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const t = useT('Nav');
  const tCommon = useT('Common');
  const locale = useLocale();
  const pathname = usePathname();

  function toggleLocale() {
    const next = locale === 'es' ? 'en' : 'es';
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const hamburger = hamburgerRef.current;
    return () => {
      hamburger?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const apply = () => {
      document.body.style.overflow = mql.matches ? '' : 'hidden';
    };
    apply();
    mql.addEventListener('change', apply);
    return () => {
      document.body.style.overflow = '';
      mql.removeEventListener('change', apply);
    };
  }, [open]);

  return (
    <>
      {/* Mobile toggle */}
      <button
        ref={hamburgerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 rounded-md bg-zinc-200 p-2 text-zinc-700 hover:bg-zinc-300 lg:hidden dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        aria-label={open ? tCommon('closeMenu') : tCommon('openMenu')}
        aria-expanded={open}
        aria-controls="mobile-nav"
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
        id="mobile-nav"
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-md transition-transform duration-200 ease-in-out dark:bg-zinc-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:shadow-none`}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="border-b border-zinc-200 px-6 py-5 pr-12 lg:pr-6 dark:border-zinc-700">
            <Logo variant="logotipo" size="md" />
          </div>

          {isLoggedIn ? (
            <>
              {/* Nav links — authenticated */}
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <ul className="space-y-1">
                  {NAV_GROUPS.map((group) => (
                    <li key={group.label}>
                      <p className="px-3 pt-3 pb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        {t(group.label)}
                      </p>
                      <ul className="space-y-1">
                        {group.items.map((item, index) => {
                          const isActive =
                            item.href === '/dashboard'
                              ? pathname === '/dashboard'
                              : pathname.startsWith(item.href);
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                ref={index === 0 && group.label === 'groupGeneral' ? firstLinkRef : undefined}
                                onClick={() => setOpen(false)}
                                aria-current={isActive ? 'page' : undefined}
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
                    </li>
                  ))}
                </ul>
              </nav>

              {/* User info + language toggle + logout */}
              <div className="mt-auto border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
                {email && (
                  <p className="mb-3 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {email}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={toggleLocale}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label={tCommon('switchLang')}
                  >
                    <Languages className="h-4 w-4" />
                    <span className="hidden sm:inline">{locale === 'es' ? 'EN' : 'ES'}</span>
                  </button>
                  <form action={logoutAction} className="flex-1">
                    <button
                      type="submit"
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t('exit')}</span>
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
                >
                  <Button variant="primary" size="sm" className="w-full">
                    {t('login')}
                  </Button>
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

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 z-50 rounded-md p-1 text-zinc-400 hover:text-zinc-600 lg:hidden dark:hover:text-zinc-200"
            aria-label={tCommon('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </aside>
    </>
  );
}
