'use client';

import { type InputHTMLAttributes, forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Icon } from '@/components/ui/icon';
import { useT } from '@/i18n/client';

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, error, required, className = '', id, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const t = useT('Auth');

    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {label}
            {required && <span className="ml-0.5 text-danger">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            required={required}
            className={`block h-10 w-full rounded-md border px-3 pr-10 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800 dark:text-white ${
              error
                ? 'border-danger focus:border-danger focus:ring-danger'
                : 'border-zinc-300'
            } ${className}`}
            {...props}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={visible ? t('hidePassword') : t('showPassword')}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <Icon icon={visible ? EyeOff : Eye} size="sm" />
          </button>
        </div>
        {error && (
          <p className="mt-1 text-xs text-danger">{error}</p>
        )}
      </div>
    );
  },
);
