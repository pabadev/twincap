'use client';

import { useEffect, useState } from 'react';
import { Icon } from './icon';
import { useT } from '../../i18n/client';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: (id: string) => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-success text-white',
  error: 'bg-danger text-white',
  info: 'bg-indigo-600 text-white',
  warning: 'bg-warning text-white',
};

const variantIcons: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export function Toast({
  id,
  message,
  variant = 'info',
  duration = 4000,
  onDismiss,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const tCommon = useT('Common');

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300);
  };

  return (
    <div
      role="alert"
      className={`
        flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg
        transition-all duration-300 ease-in-out
        ${variantStyles[variant]}
        ${isVisible && !isExiting ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
      `}
    >
      <Icon icon={variantIcons[variant]} size="sm" />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={handleDismiss}
        className="ml-2 rounded p-1 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label={tCommon('dismiss')}
      >
        <Icon icon={X} size="sm" />
      </button>
    </div>
  );
}
