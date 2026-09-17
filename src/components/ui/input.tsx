import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    required,
    className = "",
    id,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    ...props
  },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={error ? `${inputId}-error` : ariaDescribedBy}
        className={`block h-10 w-full rounded-md border px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed dark:border-surface-border dark:bg-surface-input dark:text-white ${
          error ? "border-danger focus:border-danger focus:ring-danger" : "border-surface-border"
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
