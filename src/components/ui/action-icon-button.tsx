'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { type LucideIcon } from 'lucide-react';

type ActionIconTone = 'neutral' | 'primary' | 'danger' | 'success' | 'warning';

interface ActionIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  icon: LucideIcon;
  /** Rendered as both aria-label and native title tooltip. */
  label: string;
  tone?: ActionIconTone;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const toneClasses: Record<ActionIconTone, string> = {
  neutral:
    'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800',
  primary:
    'text-primary hover:text-primary-hover hover:bg-zinc-100 dark:hover:bg-zinc-800',
  danger:
    'text-danger hover:bg-danger/10 dark:hover:bg-danger/20',
  success:
    'text-success hover:bg-success/10 dark:hover:bg-success/20',
  warning:
    'text-warning hover:bg-warning/10 dark:hover:bg-warning/20',
};

/**
 * Square circular icon-only button for table/list actions.
 * The label doubles as accessible name (aria-label) and native tooltip (title).
 */
export const ActionIconButton = forwardRef<HTMLButtonElement, ActionIconButtonProps>(
  function ActionIconButton(
    {
      icon: IconComponent,
      label,
      tone = 'neutral',
      type = 'button',
      disabled,
      loading = false,
      onClick,
      className = '',
    },
    ref,
  ) {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        title={label}
        aria-label={label}
        aria-busy={loading || undefined}
        className={`inline-flex cursor-pointer items-center justify-center rounded-full p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${toneClasses[tone]} ${className}`}
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <IconComponent size={16} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    );
  },
);
