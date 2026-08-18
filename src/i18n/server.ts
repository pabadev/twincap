import { cookies } from 'next/headers';
import type { Locale, Namespace, Messages } from './types';
import { DEFAULT_LOCALE, LOCALES } from './types';
import { interpolate } from './interpolate';

const messagesCache = new Map<string, Messages>();

async function loadMessages(locale: Locale): Promise<Messages> {
  const cached = messagesCache.get(locale);
  if (cached) return cached;

  const mod = await import(`../../messages/${locale}.json`);
  const messages = mod.default as Messages;
  messagesCache.set(locale, messages);
  return messages;
}

/**
 * Server-side translation function.
 * Reads locale from NEXT_LOCALE cookie and returns a `t(key, params?)` resolver.
 *
 * Usage in Server Components:
 *   const t = await getT('Dashboard');
 *   return <h1>{t('welcomeBack')}</h1>;
 *   return <span>{t('principal', { currency: 'COP' })}</span>;
 */
export async function getT<N extends Namespace>(
  namespace: N,
): Promise<(key: string, params?: Record<string, string>) => string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value;
  const locale: Locale =
    raw && LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;

  const messages = await loadMessages(locale);
  const ns = messages[namespace] as Record<string, string> | undefined;

  return function t(key: string, params?: Record<string, string>): string {
    if (!ns) return key;
    const value = ns[key] ?? key;
    return params ? interpolate(value, params) : value;
  };
}

/**
 * Get the current locale from the NEXT_LOCALE cookie (server-side).
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value;
  return raw && LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;
}
