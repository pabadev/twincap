// Presentational banner component (UX-10 S5, DEC-DS-06): the four POS danger
// banners and the profile verify banner shared no shell before this file.
// Plain-function component, no state, no i18n — copy arrives pre-translated.

import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Icon } from "./icon";

type AlertVariant = "danger" | "info";

interface AlertProps {
  variant: AlertVariant;
  /** Optional bold lead line (two-line layout: title + body). */
  title?: string;
  /** Message body (pre-translated by the caller). */
  children: ReactNode;
  /** Optional right-side action slot (e.g. resend button). */
  action?: ReactNode;
}

const variantIconStyles: Record<AlertVariant, string> = {
  danger: "text-danger",
  info: "text-info dark:text-info-soft",
};

const shellStyles: Record<AlertVariant, string> = {
  danger: "bg-danger/10",
  info: "bg-info/10 dark:bg-info/15",
};

export function Alert({ variant, title, children, action }: AlertProps) {
  const icon = (
    <Icon
      icon={variant === "danger" ? AlertCircle : Info}
      size="sm"
      className={variantIconStyles[variant]}
    />
  );
  return (
    <div
      role={variant === "danger" ? "alert" : undefined}
      className={`flex items-center justify-between gap-3 rounded-md p-3 text-sm ${shellStyles[variant]}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          {title && <p className="font-medium">{title}</p>}
          <p className={variant === "danger" ? "text-danger" : "text-info dark:text-info-soft"}>
            {children}
          </p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
