import type { ComponentPropsWithoutRef, ReactNode } from 'react';

interface TableShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Surface wrapper for standalone data tables: rounded card + slim shadow (U7
 * surface polish). The overflow-x-auto keeps wide tables scrollable on mobile.
 * Inner/detail tables inside modals and cards stay flush and use bare `<Table>`.
 */
export function TableShell({ children, className = '' }: TableShellProps) {
  return (
    <div
      className={`overflow-x-auto rounded-lg border border-surface-border bg-surface-card shadow-sm dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </div>
  );
}

type TableProps = ComponentPropsWithoutRef<'table'>;

export function Table({ className = '', ...props }: TableProps) {
  return (
    <table
      className={`w-full divide-y divide-zinc-200 dark:divide-zinc-700 ${className}`}
      {...props}
    />
  );
}

interface THeadProps {
  children: ReactNode;
  className?: string;
}

export function THead({ children, className = '' }: THeadProps) {
  return (
    <thead className={`bg-surface-header dark:bg-zinc-800 ${className}`}>
      {children}
    </thead>
  );
}

interface ThProps extends ComponentPropsWithoutRef<'th'> {
  align?: 'left' | 'right';
}

export function Th({ align = 'left', className = '', ...props }: ThProps) {
  return (
    <th
      className={`px-4 py-3 font-display text-sm font-semibold text-zinc-700 dark:text-zinc-300 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      {...props}
    />
  );
}

interface TBodyProps {
  children: ReactNode;
  className?: string;
}

export function TBody({ children, className = '' }: TBodyProps) {
  return (
    <tbody className={`divide-y divide-zinc-200 dark:divide-zinc-700 ${className}`}>
      {children}
    </tbody>
  );
}

interface TdProps extends ComponentPropsWithoutRef<'td'> {
  align?: 'left' | 'right';
}

export function Td({ align = 'left', className = '', ...props }: TdProps) {
  return (
    <td
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
      {...props}
    />
  );
}