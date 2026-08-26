'use client';

import Link from 'next/link';
import { Icon } from '../ui/icon';
import type { LucideIcon } from 'lucide-react';

interface ReportCardProps {
  href: string;
  icon: LucideIcon;
  label: string;
}

export function ReportCard({ href, icon, label }: ReportCardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-3 rounded-lg border border-surface-border bg-surface-card p-4 text-center transition-colors hover:bg-surface-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
    >
      <Icon icon={icon} size="md" className="text-zinc-600 dark:text-zinc-400" />
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
    </Link>
  );
}
