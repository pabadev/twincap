'use client';

import { useActionState } from 'react';
import { useT } from '../../../i18n/client';
import { useActionError } from '../../../lib/use-action-error';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { forgotPasswordAction } from '../actions';

export function ForgotPasswordForm() {
  const t = useT('Auth');
  const translateError = useActionError();
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, null);

  return (
    <>
      <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {t('forgotPassword')}
      </h2>
      <form action={formAction} className="mt-8 space-y-5">
        {state?.success && (
          <div className="rounded-md bg-success/10 p-3 text-sm text-success">
            {t('resetLinkSent')}
          </div>
        )}
        {state?.error && (
          <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {translateError(state.error, t('errorGeneric'))}
          </div>
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t('forgotPasswordHint')}
        </p>
        <Input
          id="email"
          name="email"
          type="email"
          label={t('email')}
          required
          autoComplete="email"
          disabled={isPending}
        />
        <Button type="submit" variant="primary" className="w-full" disabled={isPending} loading={isPending}>
          {isPending ? t('loading') : t('sendResetLink')}
        </Button>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {t('hasAccount')}{' '}
          <a href="/login" className="font-medium text-primary hover:text-primary-hover dark:text-primary">
            {t('signInLabel')}
          </a>
        </p>
      </form>
    </>
  );
}
