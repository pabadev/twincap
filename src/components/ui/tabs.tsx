"use client";

import Link from "next/link";
import { useRef } from "react";

export interface TabItem {
  id: string;
  label: string;
  /** Required for variant="link" — the target route of the section. */
  href?: string;
}

/**
 * Single tab language for the whole app (design audit 2026-10-31): underline
 * tabs — a `border-b-2` indicator over the shared `surface-border` track,
 * 44px touch targets, explicit :focus-visible outline, token-based colors
 * (no hard-coded zinc surfaces). Two variants share ONE visual:
 *
 * - "link": page-section navigation — renders <Link> with aria-current
 *   (semantic navigation pattern: native keyboard behavior, Cmd/Ctrl+click,
 *   middle-click; see Web Interface Guidelines "semantic HTML before ARIA").
 * - "tab": in-page state switch (e.g. scope filters) — renders role=tab
 *   buttons with WAI-ARIA roving tabindex + Arrow/Home/End navigation.
 *
 * NOT a tabs-panel primitive: the caller owns the switching state/URL — the
 * component never shows/hides panels, so it composes with server-driven
 * filters. Replaces the ad-hoc implementations that predated it:
 * CatalogSectionNav (link) and the movements pill track (tab).
 */
const itemBase =
  "min-h-11 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const selectedCls = "border-primary text-primary";
const idleCls =
  "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white";

export function Tabs({
  ariaLabel,
  items,
  variant,
  value,
  onChange,
  className = "",
}: {
  /** Accessible name for the tablist/nav — i18n-resolved by the caller. */
  ariaLabel: string;
  items: readonly TabItem[];
  /**
   * "link" → navigation sections (value = current route); "tab" → in-page
   * state (value = controlled selected id, onChange required).
   */
  variant: "link" | "tab";
  value: string;
  onChange?: (id: string) => void;
  /** Spacing/width tweaks of the surrounding page (e.g. mb-4/mb-6). */
  className?: string;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Auto-activation tabs pattern: Arrow keys move and activate, Home/End
  // jump. Roving tabindex keeps exactly one tab stop for the whole tablist.
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    buttonsRef.current[next]?.focus();
    if (items[next].id !== value) onChange?.(items[next].id);
  }

  if (variant === "link") {
    return (
      <nav aria-label={ariaLabel} className={`border-b border-surface-border ${className}`}>
        <div className="flex gap-2">
          {items.map((item) => {
            const selected = item.id === value;
            return (
              <Link
                key={item.id}
                href={item.href ?? "#"}
                aria-current={selected ? "page" : undefined}
                className={`${itemBase} ${selected ? selectedCls : idleCls}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`border-b border-surface-border ${className}`}
    >
      <div className="flex gap-2">
        {items.map((item, index) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => onKeyDown(event, index)}
              onClick={() => onChange?.(item.id)}
              className={`${itemBase} ${selected ? selectedCls : idleCls}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
