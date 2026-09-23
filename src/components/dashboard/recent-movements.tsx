"use client";

import Link from "next/link";
import { Card } from "../ui/card";
import { useT, useLocale } from "../../i18n/client";
import { formatAmount, formatDate } from "../../lib/format";
// R14-K §14c: the movement type lives in core; re-exported here so the
// presentation layer keeps its stable import path.
import type { SerializedMovement } from "../../core/application/dashboard/dashboard-types";
export type { SerializedMovement } from "../../core/application/dashboard/dashboard-types";

interface RecentMovementsProps {
  movements: SerializedMovement[];
  noMovementsMessage: string;
}

export function RecentMovements({ movements, noMovementsMessage }: RecentMovementsProps) {
  const t = useT("Dashboard");
  const locale = useLocale();

  if (movements.length === 0) {
    return (
      <Card contentClassName="p-4" className="lg:w-[calc(50%-12px)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("recentMovements")}
          </h3>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{noMovementsMessage}</p>
      </Card>
    );
  }

  return (
    <Card contentClassName="p-4" className="lg:w-[calc(50%-12px)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("recentMovements")}
        </h3>
        {/* Beta round 2: "Ver todos" with a button body (secondary-button
            styling) — a plain text link was easy to miss. Semantically still
            a link (page navigation) with a >=44px touch target. */}
        <Link
          href="/movements"
          className="inline-flex h-11 items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label={t("viewAllMovements")}
        >
          {t("viewAll")}
        </Link>
      </div>
      <div className="space-y-2">
        {movements.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800"
          >
            <div>
              <p className="text-sm text-zinc-900 dark:text-zinc-100">
                {m.categoryName || t("uncategorized")}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {formatDate(m.date, locale)}
              </p>
            </div>
            <span
              className={`text-sm font-medium ${
                m.type === "income" ? "text-income" : "text-expense"
              }`}
            >
              {m.type === "income" ? "+" : "−"}
              {formatAmount(m.amount, m.currency, locale)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
