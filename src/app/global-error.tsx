'use client';

import { useEffect } from 'react';
import { reportClientError } from '../lib/client-error-report';

/**
 * GLOBAL error boundary (R13-D).
 *
 * This is the LAST line of defense: it renders in place of the ROOT layout /
 * `<html>`/`<body>` when a crash occurs there, so the TranslationsProvider and
 * even the layout's providers are NOT available here. Text is therefore STATIC
 * (bilingual parity), self-contained, and avoids any component that depends on
 * context/providers.
 *
 * It reports the crash best-effort via fetch to the `POST /api/monitor` route
 * (Client Components cannot import server actions directly, and a global crash
 * also took down the root layout), then lets the user retry.
 *
 * NEVER breaks the original flow: reporting is fire-and-forget and fail-safe.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, {
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#0f172a',
          color: '#e2e8f0',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '24rem' }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            {/* es / en parity */}
            Algo salió mal / Something went wrong
          </p>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0 0 1.5rem' }}>
            {/* es / en parity */}
            Ocurrió un error inesperado. Intenta de nuevo. / An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {/* es / en parity */}
            Reintentar / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
