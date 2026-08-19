'use client';

import { type LucideIcon } from 'lucide-react';

type IconSize = 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
}

const sizeMap: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export function Icon({ icon: LucideIcon, size = 'md', className = '' }: IconProps) {
  const px = sizeMap[size];
  return <LucideIcon size={px} strokeWidth={1.5} className={className} />;
}
