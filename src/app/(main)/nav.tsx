'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT, useLocale } from '../../i18n/client';
import { usePathname } from 'next/navigation';
import { logoutAction } from '../(auth)/actions';
import { Languages, LogOut, Menu, Moon, Sun, User, X, LayoutDashboard, Tag, List, ArrowLeftRight, CreditCard, Landmark, Receipt, Users, Package, ShoppingCart } from 'lucide-react';
import { useTheme } from '../../components/theme-provider';
import { Logo } from '../../components/ui/logo';
import { Icon } from '../../components/ui/icon';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';

const NAV_ITEMS = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard, color: 'text-primary' },
  'separator',
  { href: '/accounts', key: 'accounts', icon: Landmark, color: 'text-info' },
  { href: '/categories', key: 'categories', icon: Tag, color: 'text-brand-gold' },
  { href: '/movements', key: 'movements', icon: List, color: 'text-zinc-600 dark:text-zinc-400' },
  { href: '/transfers', key: 'transfers', icon: ArrowLeftRight, color: 'text-primary' },
  'separator',
  { href: '/credits/received', key: 'creditsReceived', icon: CreditCard, color: 'text-income' },
  { href: '/credits/granted', key: 'creditsGranted', icon: Landmark, color: 'text-expense' },
  { href: '/payables', key: 'payables', icon: Receipt, color: 'text-warning' },
  'separator',
  { href: '/clients', key: 'clients', icon: Users, color: 'text-info' },
  { href: '/pos/catalog', key: 'posCatalog', icon: Package, color: 'text-brand-gold' },
  { href: '/pos/sales', key: 'posSales', icon: ShoppingCart, color: 'text-income' },
] as const;

export function MainNav({ isLoggedIn, email }: { isLoggedIn: boolean; email?: string }) {
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const router = useRouter();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const t = useT('Nav');
  const tCommon = useT('Common');
  const locale = useLocale();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

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
      {/* Mobile toggle — hidden when sidebar is open */}
      {!open && (
        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-50 rounded-md bg-zinc-200 p-2 text-zinc-700 hover:bg-zinc-300 lg:hidden dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          aria-label={tCommon('openMenu')}
          aria-controls="mobile-nav"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

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
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-surface-card shadow-md transition-transform duration-200 ease-in-out dark:bg-zinc-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:shadow-none`}
      >
        <div className="flex h-full flex-col">
          {/* Brand + mobile close */}
          <div className="relative border-b border-surface-border px-6 py-5 pr-12 lg:pr-6 dark:border-zinc-700">
            <div className="inline-flex rounded-lg bg-primary/10 px-3 py-1.5">
              <Logo variant="logotipo" size="md" />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-600 lg:hidden dark:hover:text-zinc-200"
              aria-label={tCommon('close')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {isLoggedIn ? (
            <>
              {/* Nav links — authenticated */}
              <nav className="flex-1 overflow-y-auto px-2 py-3 lg:px-2 lg:py-2">
                <ul className="space-y-0.5 lg:space-y-0">
                  {NAV_ITEMS.map((item, index) => {
                    if (item === 'separator') {
                      return (
                        <li key={`sep-${index}`}>
                          <hr className="my-0.5 border-surface-border dark:border-zinc-700" />
                        </li>
                      );
                    }
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          ref={index === 0 ? firstLinkRef : undefined}
                          onClick={() => setOpen(false)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors lg:py-1.5 ${
                            isActive
                              ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary'
                              : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
                          }`}
                        >
                          <Icon icon={item.icon} size="sm" className={isActive ? '' : item.color} />
                          {t(item.key)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* User info + language toggle + logout */}
              <div className="mt-auto border-t border-surface-border px-3 py-3 dark:border-zinc-700">
                {email && (
                  <p className="mb-2 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    {email}
                  </p>
                )}
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="mb-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <User className="h-4 w-4" />
                  <span>{t('profile')}</span>
                </Link>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleLocale}
                    className="flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label={tCommon('switchLang')}
                  >
                    <Languages className="h-4 w-4" />
                    <span>{locale === 'es' ? 'EN' : 'ES'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t('exit')}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Guest: language toggle + Login/Register */
            <div className="mt-auto border-t border-surface-border px-3 py-3 dark:border-zinc-700">
              <div className="flex flex-col gap-2">
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
                  className="block rounded-md border border-zinc-300 px-3 py-1.5 text-center text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {t('register')}
                </Link>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={toggleLocale}
                    className="flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-zinc-300 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    aria-label={tCommon('switchLang')}
                  >
                    <Languages className="h-4 w-4" />
                    <span>{locale === 'es' ? 'EN' : 'ES'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logoutAction();
        }}
        title={t('confirmTitle')}
        description={t('confirmDescription')}
        confirmLabel={t('confirmYes')}
        cancelLabel={tCommon('cancel')}
      />
    </>
  );
}
