"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./button";
import { Modal } from "./modal";

export type ConfirmationVariant = "normal" | "destination-account" | "f5-negative-balance";

export interface ConfirmationDetailRow {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface MoneyActionConfirmationProps {
  open: boolean;
  /** Only dispatches the captured FormData; never a second write. */
  onConfirm: () => void;
  /** Closes the dialog and clears the captured ref; the form stays intact. */
  onCancel: () => void;
  /** i18n-resolved by the caller — the component is label-agnostic. */
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmationVariant;
  detailRows: ConfirmationDetailRow[];
  /** destination-account variant: additional highlighted row with the target account name. */
  destinationAccountName?: string;
  /** f5-negative-balance variant: warning banner text, visible only when projectedNegative. */
  negativeBalanceWarning?: string;
  projectedNegative?: boolean;
  /** Disables both buttons and neutralizes close (ESC/backdrop/X). */
  loading?: boolean;
  tone?: "primary" | "danger";
}

/**
 * Unified informed-confirmation dialog for money-touching actions (UX-6).
 *
 * Three variants share ONE row model (design D1): the caller builds
 * `detailRows` and the variants only add chrome — a highlighted destination
 * account row for `destination-account`, and a warning banner for
 * `f5-negative-balance` when `projectedNegative`. Purely presentational and
 * controlled, label-agnostic (ConfirmDialog precedent).
 *
 * Accessibility (design D3, consolidated in UX-9 R-4): Modal owns the focus
 * trap (initial focus, Tab loop, restore). This component only keeps initial
 * focus on the confirm button and the restore-to-trigger behavior; the local
 * Tab loop was removed to avoid a second Tab handler (no double trap).
 */
export function MoneyActionConfirmation({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant,
  detailRows,
  destinationAccountName,
  negativeBalanceWarning,
  projectedNegative = false,
  loading = false,
  tone = "primary",
}: MoneyActionConfirmationProps) {
  const titleId = useId();
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Initial focus on confirm when the dialog opens; restore focus on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    confirmButtonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    };
  }, [open]);

  const showDestinationRow = variant === "destination-account" && !!destinationAccountName;
  const showWarningBanner =
    variant === "f5-negative-balance" && projectedNegative && !!negativeBalanceWarning;

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      title={title}
      titleId={titleId}
      size="sm"
      actions={
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            type="button"
            variant={tone === "primary" ? "primary" : "danger"}
            onClick={onConfirm}
            loading={loading}
            className="w-full sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {description && <p className="text-sm text-zinc-600 dark:text-zinc-300">{description}</p>}

        {showWarningBanner && (
          <div
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
          >
            {negativeBalanceWarning}
          </div>
        )}

        {showDestinationRow && (
          <div className="rounded-md bg-primary/5 px-3 py-2 text-sm font-medium text-zinc-900 dark:bg-primary/15 dark:text-white">
            {destinationAccountName}
          </div>
        )}

        {detailRows.length > 0 && (
          <dl className="space-y-3 text-sm">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <dt className="text-zinc-500 dark:text-zinc-400">{row.label}</dt>
                <dd
                  className={
                    row.highlight
                      ? "font-medium text-red-600 dark:text-red-400"
                      : "font-medium text-zinc-900 dark:text-white"
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Modal>
  );
}
