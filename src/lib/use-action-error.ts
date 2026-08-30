'use client';

import { useT } from '../i18n/client';

/**
 * Shared client-side translation for server-action error payloads.
 *
 * Server actions return i18n keys under the "error" namespace (prefixed
 * `error.`) via handleActionError; some actions still return Toast keys or
 * raw strings. This hook resolves both — error.* keys against the "error"
 * namespace, everything else against "Toast" — and falls back to a
 * caller-provided message (or the original payload) when the key is unknown.
 *
 * Usage:
 *   const translateError = useActionError();
 *   addToast(translateError(state.error), 'error');
 */
export function useActionError(): (error: string, fallback?: string) => string {
  const tError = useT('error');
  const tToast = useT('Toast');

  return (error: string, fallback?: string): string => {
    if (error.startsWith('error.')) {
      const key = error.slice('error.'.length);
      const translated = tError(key);
      return translated !== key ? translated : (fallback ?? error);
    }
    const translated = tToast(error);
    return translated !== error ? translated : (fallback ?? error);
  };
}