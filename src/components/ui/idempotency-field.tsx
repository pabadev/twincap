"use client";

import { useEffect, useRef, useState } from "react";

function generateKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Hidden field that submits a fresh idempotency key with its form.
 *
 * The key is generated once per form mount (via lazy useState initializer) so
 * that a retry of the SAME submission reuses the same key — letting the server
 * detect and drop the duplicate. A genuinely new form (remount) gets a fresh key.
 *
 * Optional `resetKey`: when its value CHANGES the key regenerates (used by
 * long-lived forms that keep the modal open across consecutive registrations,
 * e.g. POS re-invoicing — a committed sale consumes its key forever, so a
 * repeat submission with the same key would be rejected as duplicateRequest).
 *
 * Usage: place inside any <form> that submits a protected server action:
 *   <IdempotencyField resetKey={saleRound} />
 */
export function IdempotencyField({ resetKey }: { resetKey?: string | number }) {
  // Generate once per mount via lazy useState initializer (idempotent).
  const [key, setKey] = useState(generateKey);
  const prevSeedRef = useRef(resetKey);

  useEffect(() => {
    if (resetKey === undefined || resetKey === prevSeedRef.current) return;
    prevSeedRef.current = resetKey;
    setKey(generateKey());
  }, [resetKey]);

  return <input type="hidden" name="idempotencyKey" value={key} />;
}
