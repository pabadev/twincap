'use client';

import { useTransition } from 'react';
import { useT } from '../../../i18n/client';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../lib/hooks/use-toast';
import { resendVerificationAction } from './actions';

/**
 * Non-blocking "email not verified" banner (R13-B2). Shown only when the user
 * has an unverified email. The user can log in and use the app regardless;
 * this just offers a way to re-send the verification email.
 */
export function VerifyBanner({
  title,
  description,
  resend,
}: {
  title: string;
  description: string;
  resend: string;
}) {
  const t = useT('Auth');
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleResend() {
    startTransition(async () => {
      const result = await resendVerificationAction();
      if (result.success) addToast(t('verificationSent'), 'success');
      else if (result.error === 'tooManyAttempts') addToast(t('tooManyAttempts'), 'error');
      else addToast(t('errorGeneric'), 'error');
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
      <div>
        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{title}</p>
        <p className="text-sm text-amber-800 dark:text-amber-200">{description}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={handleResend} disabled={isPending} loading={isPending} className="shrink-0">
        {resend}
      </Button>
    </div>
  );
}
