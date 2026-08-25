import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, actions, children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white dark:border-surface-border dark:bg-surface-card ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-surface-border">
          {title && (
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {title}
            </h3>
          )}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
