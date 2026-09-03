'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../../i18n/client';
import { verifyEmailAction } from '../actions';

/**
 * Public email verification page (R13-B2). Reads `token` and `email` from the
 * URL and calls the verification action once. The one-time token is single-use,
 * so the page intentionally does not re-fire on re-render.
 */
export function VerifyEmailForm({ email, token }: { email: string; token: string }) {
  const t = useT('Auth');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token || !email) {
        if (!cancelled) setStatus('error');
        return;
      }
      const fd = new FormData();
      fd.set('email', email);
      fd.set('token', token);
      const result = await verifyEmailAction(null, fd);
      if (!cancelled) {
        setStatus(result?.success ? 'success' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center">
      {status === 'idle' && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('verifying')}</p>
      )}
      {status === 'success' && (
        <p className="text-sm text-success">{t('emailVerifiedSuccess')}</p>
      )}
      {status === 'error' && <p className="text-sm text-danger">{t('invalidResetToken')}</p>}
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {t('hasAccount')}{' '}
        <a href="/login" className="font-medium text-primary hover:text-primary-hover dark:text-primary">
          {t('signInLabel')}
        </a>
      </p>
      {status === 'success' && (
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t('goToDashboard')}{' '}
          <a href="/dashboard" className="font-medium text-primary hover:text-primary-hover dark:text-primary">
            {t('dashboard')}
          </a>
        </p>
      )}
    </div>
  );
}
