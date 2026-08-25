'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { useT } from '../../i18n/client';

type ModalSize = 'sm' | 'md' | 'lg';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
  /** Dialog max width: sm → max-w-sm, md → max-w-md (default), lg → max-w-2xl. */
  size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, actions, closeLabel, size = 'md' }: ModalProps) {
  const tCommon = useT('Common');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog — capped to the viewport; the body scrolls, header/actions stay visible */}
      <div
        className={`relative flex max-h-full w-full ${sizeClasses[size]} flex-col rounded-lg border border-surface-border bg-surface-card p-6 shadow-xl dark:border-surface-border dark:bg-surface-card`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          {title && (
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto cursor-pointer rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label={closeLabel || tCommon('close')}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {actions && (
          <div className="mt-6 flex shrink-0 justify-end gap-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
