import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  /**
   * §29: padding classes for the CONTENT wrapper replace the default `p-6`.
   * Use this instead of padding `className` on the root — root-level padding
   * stacks with the built-in content padding and doubles the inset.
   */
  contentClassName?: string;
}

export function Card({
  title,
  actions,
  children,
  className = "",
  headerClassName = "",
  contentClassName,
}: CardProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-surface-border bg-surface-card dark:border-surface-border dark:bg-surface-card ${className}`}
    >
      {(title || actions) && (
        <div
          className={`flex items-center justify-between border-b border-surface-border bg-surface-header px-6 py-4 dark:border-zinc-700 dark:bg-zinc-800 ${headerClassName}`}
        >
          {title && <h3 className="text-lg font-bold text-zinc-800 dark:text-white">{title}</h3>}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={contentClassName ?? "p-6"}>{children}</div>
    </div>
  );
}
