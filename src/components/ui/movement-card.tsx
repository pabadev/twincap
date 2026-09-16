import type { ReactNode } from "react";

export interface CardField {
  key: string;
  label: string;
  value: string;
  /** Extra classes applied to the value (e.g. "text-income" for colored amounts). */
  className?: string;
  /** Larger text treatment; secondary (small, muted) otherwise. */
  primary?: boolean;
}

interface MovementCardProps {
  id: string;
  fields: CardField[];
  /** Row actions (edit/delete buttons) rendered in the card footer. */
  actions?: ReactNode;
  /** Additional wrapper classes (e.g. "sm:hidden" for the mobile variant). */
  className?: string;
}

/**
 * Mobile card variant (<640px) for the pure list tables. Each field renders as
 * a label/value row: primary fields use `text-sm font-medium` (default color
 * `text-zinc-900 dark:text-white`), secondary fields `text-xs text-zinc-500
 * dark:text-zinc-400`. A field that supplies its own `className` (e.g.
 * "text-income") provides the color — replacing the default value color, the
 * same way the desktop tables combine `text-sm font-medium` with an income/
 * expense color. The surface follows the credits-received-list card pattern
 * (rounded-lg border border-surface-border bg-surface-card px-4 py-3).
 */
export function MovementCard({ id, fields, actions, className = "" }: MovementCardProps) {
  return (
    <div
      data-id={id}
      className={`rounded-lg border border-surface-border bg-surface-card px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      <dl className="space-y-2">
        {fields.map((field) => {
          const valueClasses = field.className
            ? `${field.primary ? "text-sm font-medium" : "text-xs"} ${field.className}`.trim()
            : field.primary
              ? "text-sm font-medium text-zinc-900 dark:text-white"
              : "text-xs text-zinc-500 dark:text-zinc-400";
          return (
            <div key={field.key} className="flex items-start justify-between gap-3">
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {field.label}
              </dt>
              <dd className={`text-right ${valueClasses}`}>{field.value}</dd>
            </div>
          );
        })}
      </dl>
      {actions && (
        <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {actions}
        </div>
      )}
    </div>
  );
}
