"use client";

import { useEffect, useCallback, useRef, type ReactNode } from "react";
import { useT } from "../../i18n/client";
import { useFocusTrap } from "./focus-trap";

type ModalSize = "sm" | "md" | "lg" | "xl";
type ModalVariant = "default" | "workspace";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible dialog name, rendered as the heading and wired via aria-labelledby (UX-9 R-5). */
  title: string;
  /** Optional id for the heading; when present the dialog is labeled via aria-labelledby (overrides aria-label). */
  titleId?: string;
  children: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
  /** Dialog max width: sm → max-w-sm, md → max-w-md (default), lg → max-w-2xl, xl → max-w-5xl. */
  size?: ModalSize;
  /**
   * Layout variant. "default" (default) keeps the standard scrollable body.
   * "workspace" opts into a fixed-height 3-part flex layout (header/body/footer)
   * where the body does NOT scroll — the consumer manages internal scroll regions.
   * Used by the POS sale form to pin the footer and isolate table scroll.
   */
  variant?: ModalVariant;
  /**
   * Optional close-guard: when provided, ESC / backdrop / X call this instead
   * of `onClose`. The consumer decides whether to actually close (e.g. after a
   * dirty-check confirmation). When omitted, behavior is unchanged — `onClose`
   * fires directly on every close trigger.
   */
  onRequestClose?: () => void;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

export function Modal({
  open,
  onClose,
  title,
  titleId,
  children,
  actions,
  closeLabel,
  size = "md",
  variant = "default",
  onRequestClose,
}: ModalProps) {
  const tCommon = useT("Common");

  // Close trigger: when the consumer provides `onRequestClose`, all user-initiated
  // close attempts (ESC, backdrop, X) are routed through it so the consumer can
  // gate them (e.g. dirty-check confirmation). When omitted, `onClose` fires
  // directly — backward-compatible with every existing consumer.
  const handleClose = onRequestClose ?? onClose;

  // Focus trap (UX-9 R-2): while open, focus enters the dialog, Tab/Shift+Tab
  // stay inside it, and focus returns to the trigger on close.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, { active: open });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    },
    [handleClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  // C12-3f: workspace variant pins header/footer and isolates internal scroll
  // regions. The dialog has a DEFINITE height at desktop so the flex chain is
  // bounded end-to-end. C12-3g: bumped to 90vh / 94vw / 1180px for real-world
  // laptop viewports (1366×653) so the credit-mode right column fits without
  // clipping any field (Fecha visible below Pago inicial).
  const isWorkspace = variant === "workspace";
  const dialogSizeClass = isWorkspace ? "lg:w-[94vw] lg:max-w-[1180px]" : sizeClasses[size];
  const dialogHeightClass = isWorkspace ? "lg:h-[90vh] max-h-[90vh]" : "max-h-full";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      {/* Dialog — capped to the viewport; the body scrolls, header/actions stay visible */}
      <div
        ref={dialogRef}
        className={`relative flex ${dialogHeightClass} w-full ${dialogSizeClass} flex-col overflow-hidden rounded-lg border border-surface-border bg-surface-card p-6 shadow-xl dark:border-surface-border dark:bg-surface-card`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby={titleId}
      >
        {/* C12-3f: header pinned top with z-10 so content never covers it */}
        <div className="relative z-10 mb-4 flex shrink-0 items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="ml-auto cursor-pointer rounded-md p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            aria-label={closeLabel || tCommon("close")}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* C12-3f: body fills remaining space with min-h-0 chain */}
        <div
          className={`min-h-0 flex-1 ${isWorkspace ? "overflow-hidden" : "overflow-y-auto"}`}
          data-testid={isWorkspace ? "modal-body-workspace" : undefined}
        >
          {children}
        </div>
        {/* C12-3f: footer pinned bottom with z-10, bg matches modal surface */}
        {actions && (
          <div
            className={`relative z-10 mt-6 flex shrink-0 justify-end gap-3 ${
              isWorkspace ? "border-t border-surface-border bg-surface-card pt-4" : ""
            }`}
            data-testid={isWorkspace ? "modal-footer-workspace" : undefined}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
