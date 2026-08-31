'use client';

import { useRef } from 'react';

/**
 * Hidden field that submits a fresh idempotency key with its form.
 *
 * The key is generated once per form mount (via useRef) so that a retry of
 * the SAME submission reuses the same key — letting the server detect and
 * drop the duplicate. A genuinely new form (remount) gets a fresh key.
 *
 * Usage: place inside any <form> that submits a protected server action:
 *   <IdempotencyField />
 */
export function IdempotencyField() {
  // Generate once per mount; crypto.randomUUID is available in all modern
  // browsers and in the jsdom test environment.
  const keyRef = useRef<string | null>(null);
  if (keyRef.current === null) {
    keyRef.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  return <input type="hidden" name="idempotencyKey" value={keyRef.current} />;
}
