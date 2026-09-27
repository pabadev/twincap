import { type LucideIcon } from "lucide-react";

type IconSize = "sm" | "md" | "lg" | "xl";

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

/**
 * Shared (server-safe) icon renderer. Deliberately has NO 'use client':
 * server pages pass lucide forwardRef components as the `icon` prop, and a
 * client-component boundary would try to serialize that function object
 * ("Functions cannot be passed directly to Client Components"). As a shared
 * component the prop never crosses the RSC boundary — server pages render
 * the SVG inline, client components bundle the same code. lucide-react
 * ships no side effects/hooks beyond forwardRef, so both graphs work.
 */
export function Icon({ icon: LucideIcon, size = "md", className = "" }: IconProps) {
  const px = sizeMap[size];
  return <LucideIcon size={px} strokeWidth={1.5} className={className} />;
}
