import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, required, className = '', id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
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
        <input
          ref={ref}
          id={inputId}
          required={required}
          className={`block h-10 w-full rounded-md border px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800 dark:text-white ${
            error
              ? 'border-danger focus:border-danger focus:ring-danger'
              : 'border-zinc-300'
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-danger">{error}</p>
        )}
      </div>
    );
  },
);
