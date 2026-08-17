'use client';

import { useActionState } from 'react';

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
}: {
  action: ActionFn;
  title: string;
  submitLabel: string;
  alternateText: string;
  alternateHref: string;
  alternateLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <>
      <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
        {title}
      </h2>
      <form action={formAction} className="mt-8 space-y-5">
        {state?.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {state.error}
          </div>
        )}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={title === 'Sign In' ? 'current-password' : 'new-password'}
            disabled={isPending}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isPending ? 'Loading...' : submitLabel}
        </button>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {alternateText}{' '}
          <a
            href={alternateHref}
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            {alternateLabel}
          </a>
        </p>
      </form>
    </>
  );
}
