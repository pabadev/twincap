import type { ReactNode } from "react";

interface TouchTargetProps {
  /**
   * Container element: span for inline contexts (inside buttons/links),
   * div elsewhere.
   */
  as?: "div" | "span";
  className?: string;
  children: ReactNode;
}

/**
 * Touch target expansion box (WCAG 2.5.8, spec RTT-2). Wrap the CONTENT of an
 * interactive control with this component so the control's hit area grows to
 * at least 44x44 CSS px. The inner icon/text keeps its original size
 * (SC-RTT-3) and the wrapper stays in flow, so surrounding offsets do not
 * shift (SC-RTT-2). Never add padding to the icon itself.
 */
export function TouchTarget({ as: Tag = "div", className = "", children }: TouchTargetProps) {
  return (
    <Tag
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center touch-manipulation ${className}`}
    >
      {children}
    </Tag>
  );
}
