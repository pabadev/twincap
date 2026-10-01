"use client";

import { useRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { Icon } from "./icon";

interface SearchInputProps {
  /** Accessible name (also used as the visible placeholder). */
  ariaLabel: string;
  placeholder?: string;
  clearLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Forwarded input attributes (name/maxLength/type for GET filter forms). */
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">;
  /** Hide the leading icon (e.g. inside other searchers that show a text label above). */
  hideIcon?: boolean;
}

/**
 * Shared text searcher with the founder-mandated X clear button
 * (PROJECT-RULES §15, ronda final pre-beta — mandato `docs/Prompt pre-beta.md` §16).
 *
 * Extracted from the sale-form combobox pattern: the clear click happens on
 * the intentionally non-focus-stealing element via `onMouseDown`
 * preventDefault so the input keeps focus, then re-focuses after clearing.
 * Purity: no i18n/context — callers pass all labels (FormField precedent).
 */
export function SearchInput({
  ariaLabel,
  placeholder,
  clearLabel,
  value,
  onValueChange,
  inputProps,
  hideIcon = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value.length > 0;

  return (
    <div className="relative">
      {!hideIcon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Icon icon={Search} size="sm" className="text-zinc-400" />
        </div>
      )}
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        placeholder={placeholder ?? ariaLabel}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={`block w-full rounded-lg border border-surface-border bg-surface-input py-2.5 ${
          hideIcon ? "pl-4" : "pl-10"
        } ${
          hasValue ? "pr-10" : "pr-4"
        } text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-surface-border dark:bg-surface-card dark:text-white dark:placeholder:text-zinc-500`}
        {...inputProps}
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => {
            // preventDefault on mousedown keeps focus on the input so its
            // blur handling never races this click (sale-form precedent).
            onValueChange("");
            inputRef.current?.focus();
          }}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={clearLabel}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <X size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
