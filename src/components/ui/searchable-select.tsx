'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsMessage: string;
  label?: string;
  error?: string;
  required?: boolean;
  debounceMs?: number;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noResultsMessage,
  label,
  error,
  required,
  debounceMs = 300,
}: SearchableSelectProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return options;
    const q = debouncedSearch.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, debouncedSearch]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          inputRef.current?.focus();
        }}
        className={`flex h-10 w-full cursor-pointer items-center rounded-md border bg-white px-3 text-left text-sm shadow-sm dark:bg-zinc-800 ${
          error
            ? 'border-danger focus:border-danger focus:ring-danger'
            : 'border-zinc-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-zinc-600'
        }`}
      >
        {selectedLabel || <span className="text-zinc-400">{placeholder}</span>}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 p-2 dark:border-zinc-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">{noResultsMessage}</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange?.(opt.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      opt.value === value
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                        : ''
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
