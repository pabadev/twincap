"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Input } from "./input";
import { useT, useLocale } from "../../i18n/client";
import { formatAmount } from "../../lib/format";
import { parseMoneyInput } from "../../lib/money-input";

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
  labelClassName?: string;
  /** Inclusive lower bound (major units). Native min/max attributes do NOT
   *  apply to text inputs, so bounds are enforced via setCustomValidity —
   *  the submit is blocked exactly like the old type="number" contract. */
  min?: number;
  /** Inclusive upper bound (major units) — e.g. an abono's pending. */
  max?: number;
  /**
   * Currency the amount is recorded in (the account's, per project rule §4) —
   * drives the live preview. Informational only; the backend always resolves
   * the currency from the workspace account.
   */
  currency: string;
}

/** Aligned with React's onInput signature (stays in sync with its types). */
type MoneyInputEvent = Parameters<
  NonNullable<InputHTMLAttributes<HTMLInputElement>["onInput"]>
>[0];

/**
 * Money amount field (beta feedback #13).
 *
 * Text input with `inputMode="decimal"` — numeric keyboard on mobile, comma
 * available on es keyboards — plus a live preview of the exact value that
 * will be recorded. The previous `type="number"` silently reshaped
 * Spanish-style typing: "5.000" (five thousand) became 5 because the browser
 * reads the dot as a decimal separator.
 *
 * The preview is self-managed (uncontrolled input + onInput), so forms keep
 * their FormData-based submit flow untouched; parsing happens once
 * server-side through the same `parseMoneyInput` the preview uses.
 */
export function MoneyInput({ currency, onInput, min, max, error, ...props }: MoneyInputProps) {
  const t = useT("Common");
  const locale = useLocale();
  const [preview, setPreview] = useState<{ raw: string; value: string } | null>(null);
  const [boundError, setBoundError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // React 19 resets uncontrolled fields to their defaultValue AFTER a form
  // action completes — the onInput handler never fires for that reset, which
  // left a STALE preview (founder screenshot 2026-10-19: input back at
  // "25000" while the preview still showed the typed "20.000"). This effect
  // re-syncs the preview to the input's REAL value after every render. It
  // deliberately does nothing while the field is untouched (preview null +
  // value still the initial defaultValue) so fresh forms show no noise.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const raw = el.value;
    if (preview && preview.raw === raw) return;
    if (!preview && raw === String(props.defaultValue ?? "")) return;
    if (!raw.trim()) {
      setPreview(null);
      setBoundError(null);
      el.setCustomValidity("");
      return;
    }
    const parsed = parseMoneyInput(raw);
    setPreview(
      parsed === null ? { raw, value: "" } : { raw, value: formatAmount(parsed, currency, locale) },
    );
    let message: string | null = null;
    if (parsed !== null) {
      if (min !== undefined && parsed < min) {
        message = t("moneyBelowMin", { min: formatAmount(min, currency, locale) });
      } else if (max !== undefined && parsed > max) {
        message = t("moneyExceedsMax", { max: formatAmount(max, currency, locale) });
      }
    }
    el.setCustomValidity(message ?? "");
    setBoundError(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync on every render; the preview IS the dep.
  });

  const handleInput = (e: MoneyInputEvent) => {
    onInput?.(e);
    const input = inputRef.current ?? e.currentTarget;
    const raw = input.value;
    if (!raw.trim()) {
      setPreview(null);
      setBoundError(null);
      input.setCustomValidity("");
      return;
    }
    const parsed = parseMoneyInput(raw);
    setPreview(
      parsed === null
        ? { raw, value: "" }
        : { raw, value: formatAmount(parsed, currency, locale) },
    );
    let message: string | null = null;
    if (parsed !== null) {
      if (min !== undefined && parsed < min) {
        message = t("moneyBelowMin", { min: formatAmount(min, currency, locale) });
      } else if (max !== undefined && parsed > max) {
        message = t("moneyExceedsMax", { max: formatAmount(max, currency, locale) });
      }
    }
    // Blocks the form submit natively (same contract type="number" gave us).
    input.setCustomValidity(message ?? "");
    setBoundError(message);
  };

  const showInvalidPreview = preview !== null && preview.value === "";

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        error={error ?? boundError ?? undefined}
        onInput={handleInput}
        {...props}
      />
      {preview && (
        <p
          aria-live="polite"
          className={`mt-1 text-xs ${
            showInvalidPreview ? "text-warning" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {showInvalidPreview ? t("moneyPreviewInvalid") : t("moneyPreview", { value: preview.value })}
        </p>
      )}
    </div>
  );
}
