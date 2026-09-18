// Presentational banner component (UX-10 S5, DEC-DS-06): the four POS danger
// banners and the profile verify banner shared no shell before this file.
// Plain-function component, no state, no i18n — copy arrives pre-translated.
// UX-12: gains the `success` variant (DEC-DS-06 pull-rule met by the 2 auth
// success banners).

import type { ReactNode } from "react";
import { AlertCircle, CircleCheck, Info } from "lucide-react";
import { Icon } from "./icon";

type AlertVariant = "danger" | "info" | "success";

interface AlertProps {
  variant: AlertVariant;
  /** Optional bold lead line (two-line layout: title + body). */
  title?: string;
  /** Message body (pre-translated by the caller). */
  children: ReactNode;
  /** Optional right-side action slot (e.g. resend button). */
  action?: ReactNode;
}

const alertIcons: Record<AlertVariant, typeof AlertCircle> = {
  danger: AlertCircle,
  info: Info,
  success: CircleCheck,
};

const variantIconStyles: Record<AlertVariant, string> = {
  danger: "text-danger",
  info: "text-info dark:text-info-soft",
  success: "text-success",
};

const shellStyles: Record<AlertVariant, string> = {
  danger: "bg-danger/10",
  info: "bg-info/10 dark:bg-info/15",
  success: "bg-success/10",
};

const messageStyles: Record<AlertVariant, string> = {
  danger: "text-danger",
  info: "text-info dark:text-info-soft",
  success: "text-success",
};

export function Alert({ variant, title, children, action }: AlertProps) {
  const icon = <Icon icon={alertIcons[variant]} size="sm" className={variantIconStyles[variant]} />;
  return (
    <div
      role={variant === "danger" ? "alert" : undefined}
      className={`flex items-center justify-between gap-3 rounded-md p-3 text-sm ${shellStyles[variant]}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          {title && <p className="font-medium">{title}</p>}
          <p className={messageStyles[variant]}>{children}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
