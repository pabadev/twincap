'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="rounded-lg border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          {title && (
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="Close"
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
        <div className="mb-6">{children}</div>
        {actions && <div className="flex justify-end gap-3">{actions}</div>}
      </div>
    </dialog>
  );
}
