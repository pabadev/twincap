// Field-shell wrapper (UX-10 S6, D8): centralizes the htmlFor/label/error/
// aria-invalid/aria-describedby wiring for hand-rolled field sites that the
// Input/Select control-level pattern does not reach (sale-form line items,
// feedback textarea). Purity: no i18n imports, no context, no server coupling.
// Mirrors ui/input.tsx label + error class conventions.

import type { ReactElement } from "react";
import { Children, cloneElement, isValidElement } from "react";

interface FormFieldProps {
  /** Stable field id — reused for <label htmlFor>, hint id and error id. */
  id: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  /** Validation error — renders adjacent as <p id="{id}-error">. */
  error?: string;
  /** Neutral helper text announced via aria-describedby. */
  hint?: string;
  /** Extra classes for the hint paragraph (e.g. warning tint for credit-mode hint). */
  hintClassName?: string;
  /** Default true; false → decorative aria-hidden column header (line rows 2+). */
  showLabel?: boolean;
  /** Extra classes for the label element (e.g. whitespace-nowrap for tight line rows). */
  labelClassName?: string;
  /** Exactly one control element — wiring is injected via cloneElement. */
  children: ReactElement;
}

export function FormField({
  id,
  label,
  required,
  disabled,
  error,
  hint,
  hintClassName,
  showLabel = true,
  labelClassName,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const childProps = Children.only(children) && isValidElement(children) ? children.props : {};
  const childPropsRecord = childProps as Record<string, unknown>;
  const childInvalid = childPropsRecord["aria-invalid"];
  const originalDescribedBy = childPropsRecord["aria-describedby"];

  const describedBy: string[] = [];
  if (hintId) describedBy.push(hintId);
  if (errorId) describedBy.push(`${id}-error`);
  if (typeof originalDescribedBy === "string" && originalDescribedBy.length > 0) {
    describedBy.push(originalDescribedBy);
  }

  // Fallthrough semantics: only override child props when the wrapper actually
  // owns a value — cloneElement would otherwise override live child props
  // (conditional required, its own aria-describeby) with injected undefined.
  const injected: Record<string, unknown> = { id };
  if (required !== undefined) injected.required = required;
  if (disabled !== undefined) injected.disabled = disabled;
  const invalid = childInvalid ?? (error ? true : undefined);
  if (invalid !== undefined) injected["aria-invalid"] = invalid;
  if (describedBy.length > 0) injected["aria-describedby"] = describedBy.join(" ");

  const control = isValidElement(children) ? cloneElement(children, injected) : children;

  const labelClasses = `mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300${
    labelClassName ? ` ${labelClassName}` : ""
  }`;

  return (
    <div>
      {showLabel ? (
        <label htmlFor={id} className={labelClasses}>
          {label}
        </label>
      ) : (
        <span aria-hidden="true" className={labelClasses}>
          {label}
        </span>
      )}
      {control}
      {hint && (
        <p
          id={`${id}-hint`}
          className={`mt-1 text-xs text-zinc-500 dark:text-zinc-400${hintClassName ? ` ${hintClassName}` : ""}`}
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export type { FormFieldProps };
