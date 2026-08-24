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
 * Brand mark: public/isotipo-twincap.png (256px, transparent background).
 * Rendered as <img> so the browser caches one asset across pages.
 */
function LogoIcon({ size, decorative }: { size: number; decorative: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset, one URL, no optimization pipeline needed
    <img
      src="/isotipo-twincap.png"
      width={size}
      height={size}
      alt={decorative ? '' : 'TwinCap'}
      aria-hidden={decorative || undefined}
      className="object-contain"
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
        className={`font-display font-bold tracking-tight ${config.text}`}
      >
        <span className="text-brand-teal">Twin</span>
        <span className="text-brand-gold">Cap</span>
      </span>
    </div>
  );
}
