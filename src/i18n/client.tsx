'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { interpolate } from './interpolate';

type NamespaceMessages = Record<string, string>;
type AllMessages = Record<string, NamespaceMessages>;

interface TranslationsContextValue {
  messages: AllMessages;
  locale: string;
}

const TranslationsContext = createContext<TranslationsContextValue>({
  messages: {},
  locale: 'es',
});

/**
 * Client-side provider that wraps the app with translation messages.
 * Replaces NextIntlClientProvider.
 */
export function TranslationsProvider({
  messages,
  locale,
  children,
}: {
  messages: AllMessages;
  locale: string;
  children: ReactNode;
}) {
  return (
    <TranslationsContext.Provider value={{ messages, locale }}>
      {children}
    </TranslationsContext.Provider>
  );
}

/**
 * Client-side translation hook.
 * Returns a `t(key, params?)` function scoped to the given namespace.
 *
 * Usage:
 *   const t = useT('Nav');
 *   return <span>{t('dashboard')}</span>;
 *   return <span>{t('principal', { currency: 'COP' })}</span>;
 */
export function useT(
  namespace: string,
): (key: string, params?: Record<string, string>) => string {
  const { messages } = useContext(TranslationsContext);
  const ns = messages[namespace] || {};

  return function t(key: string, params?: Record<string, string>): string {
    const value = ns[key] ?? key;
    return params ? interpolate(value, params) : value;
  };
}

/**
 * Client-side hook to get the current locale.
 */
export function useLocale(): string {
  const { locale } = useContext(TranslationsContext);
  return locale;
}
