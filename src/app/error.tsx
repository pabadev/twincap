'use client';

import { useEffect } from 'react';
import { useT } from '../i18n/client';
import { Button } from '../components/ui/button';
import { Icon } from '../components/ui/icon';
import { AlertTriangle } from 'lucide-react';
import { reportClientError } from '../lib/client-error-report';

/**
 * Root-level error boundary (R13-D). Catches render errors for the route
 * segments NOT already covered by `(main)/error.tsx` — i.e. `(auth)`,
 * `(legal)` and any ungrouped routes. Sits INSIDE the root layout, so the
 * TranslationsProvider is available and i18n works here.
 *
 * On error it reports best-effort to the monitoring backend (fail-safe) and
 * offers a retry via the built-in `reset`.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT('Errors');

  useEffect(() => {
    // Never breaks the boundary flow; logs to console + POSTs to /api/monitor.
    reportClientError(error, {
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-bg px-4 text-center dark:bg-zinc-950">
      <Icon icon={AlertTriangle} size="xl" className="mb-4 text-warning" />
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {t('title')}
      </h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {t('description')}
      </p>
      <Button onClick={reset} className="mt-4">
        {t('retry')}
      </Button>
    </div>
  );
}
