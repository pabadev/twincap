'use client';

import { useState } from 'react';

/**
 * Hidden field that submits a fresh idempotency key with its form.
 *
 * The key is generated once per form mount (via lazy useState initializer) so
 * that a retry of the SAME submission reuses the same key — letting the server
 * detect and drop the duplicate. A genuinely new form (remount) gets a fresh key.
 *
 * Usage: place inside any <form> that submits a protected server action:
 *   <IdempotencyField />
 */
export function IdempotencyField() {
  // Generate once per mount via lazy useState initializer (idempotent). The
  // same key is reused for the whole form mount (retries reuse it) and a
  // remount gets a fresh key. crypto.randomUUID is available in all modern
  // browsers and in the jsdom test environment.
  const [key] = useState(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  return <input type="hidden" name="idempotencyKey" value={key} />;
}
