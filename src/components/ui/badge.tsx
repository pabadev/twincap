type BadgeVariant = "default" | "success" | "danger" | "warning" | "info" | "debt";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-zinc-100 text-zinc-700 dark:bg-surface-card dark:text-zinc-300",
  // Tinted variants keep the hue identity via the /10 pill background; the
  // text stays neutral zinc for AA contrast (D6, UX-10 — visible appearance
  // change accepted by spec).
  success: "bg-success/10 text-zinc-900 dark:text-zinc-100",
  danger: "bg-danger/10 text-zinc-900 dark:text-zinc-100",
  warning: "bg-warning/10 text-zinc-900 dark:text-zinc-100",
  info: "bg-info/10 text-zinc-900 dark:text-zinc-100",
  debt: "bg-debt/10 text-zinc-900 dark:text-zinc-100",
};

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
