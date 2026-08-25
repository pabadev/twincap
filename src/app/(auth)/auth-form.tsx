'use client';

import { useActionState } from 'react';
import { useT } from '../../i18n/client';
import { Input } from '../../components/ui/input';
import { PasswordInput } from '../../components/ui/password-input';
import { Button } from '../../components/ui/button';

type ActionFn = (
  prev: { error: string } | null,
  formData: FormData,
) => Promise<{ error: string } | null>;

export function AuthForm({
  action,
  title,
  submitLabel,
  alternateText,
  alternateHref,
  alternateLabel,
  authMode,
}: {
  action: ActionFn;
  title: string;
  submitLabel: string;
  alternateText: string;
  alternateHref: string;
  alternateLabel: string;
  authMode: 'login' | 'register';
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  const t = useT('Auth');

  return (
    <>
      <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {title}
      </h2>
      <form action={formAction} className="mt-8 space-y-5">
        {state?.error && (
          <div className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {state.error}
          </div>
        )}
        <Input
          id="email"
          name="email"
          type="email"
          label={t('email')}
          required
          autoComplete="email"
          disabled={isPending}
        />
        <PasswordInput
          id="password"
          name="password"
          label={t('password')}
          required
          minLength={8}
          autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
          disabled={isPending}
        />
        {authMode === 'register' && (
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label={t('confirmPassword')}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
          />
        )}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={isPending}
          loading={isPending}
        >
          {isPending ? t('loading') : submitLabel}
        </Button>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {alternateText}{' '}
          <a
            href={alternateHref}
            className="font-medium text-primary hover:text-primary-hover dark:text-primary"
          >
            {alternateLabel}
          </a>
        </p>
      </form>
    </>
  );
}
