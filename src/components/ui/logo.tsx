'use client';

interface LogoProps {
  variant?: 'logotipo' | 'isotipo';
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { icon: 24, text: 'text-sm', gap: 'gap-1.5' },
  md: { icon: 32, text: 'text-lg', gap: 'gap-2' },
  lg: { icon: 48, text: 'text-2xl', gap: 'gap-3' },
} as const;

/**
 * Brand mark sourced from public/isotipo-twincap.svg (cleaned vectorization
 * of the official logo). Rendered as <img> so the ~1k paths stay out of the
 * React tree and the browser caches a single asset across pages.
 */
function LogoIcon({ size, decorative }: { size: number; decorative: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset, one URL, no optimization pipeline needed
    <img
      src="/isotipo-twincap.svg"
      width={size}
      height={size}
      alt={decorative ? '' : 'TwinCap'}
      aria-hidden={decorative || undefined}
      className="rounded-lg"
      draggable={false}
    />
  );
}

export function Logo({ variant = 'logotipo', size = 'md' }: LogoProps) {
  const config = sizeConfig[size];

  if (variant === 'isotipo') {
    return <LogoIcon size={config.icon} decorative={false} />;
  }

  return (
    <div className={`flex items-center ${config.gap}`}>
      <LogoIcon size={config.icon} decorative />
      <span
        className={`font-bold tracking-tight text-zinc-900 dark:text-white ${config.text}`}
      >
        TwinCap
      </span>
    </div>
  );
}
