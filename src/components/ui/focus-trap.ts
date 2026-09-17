"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface UseFocusTrapOptions {
  /** Whether the trap is active (normally mirrors "dialog/drawer open"). */
  active: boolean;
  /**
   * Optional resolver for the element that receives initial focus; when
   * omitted, the first focusable inside the container wins. Must be stable
   * (useCallback) if derived from props, since it is part of the effect deps.
   */
  initialFocus?: () => HTMLElement | null;
}

/**
 * Shared focus trap (UX-9 R-1, D1) — hand-rolled, no dependencies.
 *
 * While `active` over a mounted container it: (a) moves focus to the initial
 * element (first focusable by default), (b) keeps Tab/Shift+Tab cycling within
 * the container, and (c) restores focus to the previously focused element when
 * deactivated/unmounted. Generalized from the local trap that lived in
 * MoneyActionConfirmation (UX-6) so Modal and the mobile drawer share ONE
 * implementation (DEC-DS-10).
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { active, initialFocus }: UseFocusTrapOptions,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    (initialFocus?.() ?? getFocusable()[0])?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      previouslyFocused?.focus();
    };
  }, [active, containerRef, initialFocus]);
}
