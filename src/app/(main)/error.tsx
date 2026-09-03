'use client';

import { useEffect } from 'react';
import { useT } from '../../i18n/client';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icon';
import { AlertTriangle } from 'lucide-react';
import { reportClientError } from '../../lib/client-error-report';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT('Errors');

  useEffect(() => {
    // Report the render error (best-effort POST to /api/monitor + console.log)
    // without ever breaking the boundary's reset/retry flow.
    reportClientError(error, { path: typeof window !== 'undefined' ? window.location.pathname : undefined });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
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
