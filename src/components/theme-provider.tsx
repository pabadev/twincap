'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<ResolvedTheme>('light');

  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const applyTheme = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setTheme(resolved);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('twincap-theme') as ThemeMode | null;
    const initial = stored || 'system';
    setModeState(initial);
    applyTheme(initial === 'system' ? getSystemTheme() : initial);
  }, [applyTheme, getSystemTheme]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(getSystemTheme());
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode, applyTheme, getSystemTheme]);

  const setThemeFn = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('twincap-theme', newMode);
    applyTheme(newMode === 'system' ? getSystemTheme() : newMode);
  }, [applyTheme, getSystemTheme]);

  return (
    <ThemeContext.Provider value={{ mode, theme, setTheme: setThemeFn }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
