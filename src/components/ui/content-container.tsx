import type { ReactNode } from "react";

/**
 * Width-control container for the app area.
 *
 * The authenticated/analytics layouts keep `main` filling the full space next
 * to the sidebar; this component caps and centers the visual content so cards
 * and blocks do not stretch across huge viewports. Horizontal gutters come
 * from the layout's responsive `main` padding (p-4 lg:p-8) — the container
 * adds none, so small-screen behavior stays exactly as before.
 *
 * Variants:
 *  - `standard`: max-w-7xl (1280px) — balanced content (Dashboard, forms).
 *  - `wide`:     max-w-[1536px] — dense tables/views that justify more width.
 */
type ContentContainerVariant = "standard" | "wide";

const WIDTHS: Record<ContentContainerVariant, string> = {
  standard: "max-w-7xl",
  wide: "max-w-[1536px]",
};

interface ContentContainerProps {
  variant?: ContentContainerVariant;
  className?: string;
  children: ReactNode;
}

export function ContentContainer({
  variant = "standard",
  className = "",
  children,
}: ContentContainerProps) {
  return <div className={`mx-auto w-full ${WIDTHS[variant]} ${className}`}>{children}</div>;
}
