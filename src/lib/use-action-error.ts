'use client';

import { useCallback } from 'react';
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
 * The returned function is memoized (U1) so error effects that list
 * `translateError` in their deps do not re-fire on every render. Note this is
 * best-effort: `useT` functions change identity after a `router.refresh()`
 * (messages are re-imported per RSC request), so the `successShownRef` guard
 * pattern remains the real fix for effect loops.
 *
 * Usage:
 *   const translateError = useActionError();
 *   addToast(translateError(state.error), 'error');
 */
export function useActionError(): (error: string, fallback?: string) => string {
  const tError = useT('error');
  const tToast = useT('Toast');

  return useCallback(
    (error: string, fallback?: string): string => {
      if (error.startsWith('error.')) {
        const key = error.slice('error.'.length);
        const translated = tError(key);
        return translated !== key ? translated : (fallback ?? error);
      }
      const translated = tToast(error);
      return translated !== error ? translated : (fallback ?? error);
    },
    [tError, tToast],
  );
}