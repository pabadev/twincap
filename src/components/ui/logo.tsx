'use client';

interface LogoProps {
  variant?: 'logotipo' | 'isotipo';
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { icon: 24, text: 'text-sm', gap: 'gap-1.5', svg: 20 },
  md: { icon: 32, text: 'text-lg', gap: 'gap-2', svg: 26 },
  lg: { icon: 48, text: 'text-2xl', gap: 'gap-3', svg: 38 },
} as const;

function LogoIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background rounded square */}
      <rect
        width="40"
        height="40"
        rx="10"
        className="fill-indigo-600 dark:fill-indigo-500"
      />
      {/* T letterform */}
      <path
        d="M10 11h20v3H24v14h-3V14h-2v14h-3V14h-6v-3z"
        className="fill-white"
      />
      {/* Upward trend line — growth accent */}
      <path
        d="M12 30l6-6 4 3 8-9"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
      {/* Arrow tip */}
      <path
        d="M26 15l3.5-1.5-1-3.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  );
}

export function Logo({ variant = 'logotipo', size = 'md' }: LogoProps) {
  const config = sizeConfig[size];

  if (variant === 'isotipo') {
    return <LogoIcon size={config.icon} />;
  }

  return (
    <div className={`flex items-center ${config.gap}`}>
      <LogoIcon size={config.icon} />
      <span
        className={`font-bold tracking-tight text-zinc-900 dark:text-white ${config.text}`}
      >
        TwinCap
      </span>
    </div>
  );
}
