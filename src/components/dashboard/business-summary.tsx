"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "../../i18n/client";
import { Card } from "../ui/card";
import { Icon } from "../ui/icon";
import { Tabs } from "../ui/tabs";
import { Input } from "../ui/input";
import { SummaryTable } from "./summary-table";
import { formatAmount } from "../../lib/format";

interface BusinessSummaryRow {
  currency: string;
  salesMinor: number;
  saleCount: number;
  averageSaleMinor: number | null;
  knownCostMinor: number;
  grossProfitMinor: number | null;
  expensesMinor: number;
  receivableMinor: number;
  registeredResultMinor: number | null;
  incompleteSales: number;
  topItems: Array<{ itemId: string; name: string; salesMinor: number }>;
}

/** H-23: the block reads via the API route handler (pure JSON, no route
 * re-render flight — the server-action carrier caused the dialog/reset
 * races inside the page proxy). */
async function fetchBusinessResult(from: string, to: string): Promise<BusinessSummaryRow[]> {
  const res = await fetch(`/api/business/result?from=${from}&to=${to}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { rows: BusinessSummaryRow[] };
  return data.rows;
}
import type { CurrencyTotal } from "../../core/application/compute-category-summary";

const PRESETS = ["thisMonth", "lastMonth", "thisYear", "custom"] as const;
type BusinessPreset = (typeof PRESETS)[number];

/** Local-civil "today" as YYYY-MM-DD. Matches the CLIENT_TZ cookie semantics:
 * the browser timezone IS the client's civil calendar (financial principle 6).
 */
function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function localDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** A civil month window: delta 0 = current month-to-date, -1 = full previous
 * civil month (computed in the LOCAL calendar — consistent with the client tz
 * cookie the server uses as "today" anchor). */
function monthWindow(today: string, delta: -1 | 0): { from: string; to: string } {
  const now = new Date(`${today}T12:00:00`);
  const first = new Date(now.getFullYear(), now.getMonth() + delta, 1);
  if (delta === 0) return { from: localDay(first), to: today };
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { from: localDay(first), to: localDay(last) };
}

/** Full civil year range (Jan 1 → today). */
function thisYearRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

function isValidRange(from: string, to: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;
  return from <= to;
}

function rangeForPreset(
  preset: BusinessPreset,
  today: string,
  custom: { from: string; to: string },
): { from: string; to: string } {
  if (preset === "thisMonth") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "lastMonth") return monthWindow(today, -1);
  if (preset === "thisYear") return thisYearRange(today);
  return custom;
}

/**
 * H-19 (fundador 2026-10-31): the business profitability block lives INSIDE
 * the Resumen, rendered only on the Negocio tab.
 *
 * Data flow is PARENT-CONTROLLED: the block reports the selected
 * range via onRangeChange and the dashboard-content refetches the whole
 * snapshot with it (one range per tab — tables, tops, recent, chart and the
 * flow cards all share the window). The block only fetches ITS OWN aggregate
 * rows (fetch to /api/business/result) for the same range. URL persistence lives in
 * handleFiltersChange (the ?desde/?hasta params written there).
 * Range presets render through the shared Tabs kit — a Select would be the
 * same 4 options with 2 taps instead of 0 (widget contraction rule).
 */
export function BusinessSummaryBlock({
  locale,
  range,
  onRangeChange,
}: {
  locale: string;
  /** Parent-owned civil window (dashboard-content state). */
  range: { from: string; to: string };
  /** Report a valid new window upward (drives snapshot + URL). */
  onRangeChange: (range: { from: string; to: string }) => void;
}) {
  const t = useT("BusinessAnalytics");
  const tCommon = useT("Common");
  const today = localToday();

  // The active preset is DERIVED from the range: a range that matches a
  // labelled window maps back to that label; anything else is "custom".
  const preset: BusinessPreset = (() => {
    if (range.from === `${today.slice(0, 7)}-01` && range.to === today) return "thisMonth";
    const last = monthWindow(today, -1);
    if (range.from === last.from && range.to === last.to) return "lastMonth";
    const year = thisYearRange(today);
    if (range.from === year.from && range.to === year.to) return "thisYear";
    return "custom";
  })();

  // Draft values for the custom date inputs — uncontrolled with a parent
  // range key below: the inputs REMOUNT whenever the parent range changes,
  // so the draft follows the window without setState-in-effect.
  const [draftState, setDraftState] = useState({ range });
  const draft = draftState.range;

  const [rows, setRows] = useState<BusinessSummaryRow[] | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const seq = ++seqRef.current;
    let cancelled = false;
    fetchBusinessResult(range.from, range.to)
      .then((result) => {
        if (!cancelled && seqRef.current === seq) setRows(result ?? []);
      })
      .catch(() => {
        // Read path fail-open: an empty set renders the block's empty state
        // instead of an exception wall (same policy as the movements fetch).
        if (!cancelled && seqRef.current === seq) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  const isLoading = rows === null;

  function presetClick(id: string) {
    const value = (PRESETS.includes(id as BusinessPreset) ? id : "thisMonth") as BusinessPreset;
    if (value === preset) return;
    onRangeChange(rangeForPreset(value, today, draft));
  }

  const loadingSkeleton = (
    <Card>
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-zinc-600 dark:text-zinc-400">
        <Icon icon={Loader2} size="sm" className="animate-spin" />
        {tCommon("loading")}
      </p>
    </Card>
  );

  return (
    <div className="space-y-4" data-testid="business-summary">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("summaryTitle")}</h2>

      <Tabs
        ariaLabel={t("period")}
        variant="tab"
        value={preset}
        onChange={(id) => presetClick(id)}
        items={[
          { id: "thisMonth", label: t("presetThisMonth") },
          { id: "lastMonth", label: t("presetLastMonth") },
          { id: "thisYear", label: t("presetThisYear") },
          { id: "custom", label: t("presetCustom") },
        ]}
        className="mb-2"
      />

      {preset === "custom" && (
        <div className="grid grid-cols-2 gap-3">
          {/* key+defaultValue pattern: the draft REKEYS when the parent range
              changes, so the inputs follow the current window (§15.19-adjacent:
              no default value on initial render beyond the restored range). */}
          <Input
            key={`from-${range.from}`}
            type="date"
            label={t("from")}
            defaultValue={draft.from}
            onChange={(e) => {
              const next = e.target.value;
              setDraftState({ range: { ...draft, from: next } });
              if (isValidRange(next, draft.to)) onRangeChange({ from: next, to: draft.to });
            }}
          />
          <Input
            key={`to-${range.to}`}
            type="date"
            label={t("to")}
            defaultValue={draft.to}
            onChange={(e) => {
              const next = e.target.value;
              setDraftState({ range: { ...draft, to: next } });
              if (isValidRange(draft.from, next)) onRangeChange({ from: draft.from, to: next });
            }}
          />
        </div>
      )}
      {preset === "custom" && !isValidRange(draft.from, draft.to) && (
        <p className="text-xs text-danger">{t("invalidRange")}</p>
      )}

      {isLoading ? (
        loadingSkeleton
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-surface-muted">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {rows.map((row) => (
            <BusinessCurrencyGroup key={row.currency} row={row} locale={locale} />
          ))}
        </div>
      )}

      <p className="text-xs text-surface-muted">{t("plainLanguageNote")}</p>
    </div>
  );
}

/**
 * FOUNDER LAYOUT (2026-10-31, 2x2): each currency renders FOUR equal cards in
 * a 2-column grid (stacked on mobile) — Resultado / Actividad / Desglose /
 * Más vendido. The currency is a muted group label; every amount carries its
 * own currency suffix already. The parent wraps each group with vertical gap.
 */
function BusinessCurrencyGroup({ row, locale }: { row: BusinessSummaryRow; locale: string }) {
  const t = useT("BusinessAnalytics");
  const money = (minor: number) => formatAmount(minor, row.currency, locale);

  return (
    <div className="space-y-3">
      <p className="text-[11px] uppercase tracking-wide text-surface-muted">{row.currency}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Card 1 — Result (promoted). Ya-cobraste stays here: it is the
            secondary figure of THIS result (sale income − pending). */}
        <Card title={t("businessCardTitle")} contentClassName="space-y-4 p-3 sm:p-4">
          <section aria-label={t("finalResult")}>
            <p className="text-sm text-surface-muted">{t("finalResult")}</p>
            {row.registeredResultMinor === null ? (
              <p className="mt-1 text-xl font-semibold text-warning">{t("needsCost")}</p>
            ) : (
              <p
                className={`mt-1 text-2xl font-semibold tabular-nums ${
                  row.registeredResultMinor > 0
                    ? "text-income"
                    : row.registeredResultMinor < 0
                      ? "text-expense"
                      : ""
                }`}
              >
                {money(row.registeredResultMinor)}
              </p>
            )}
            <p className="mt-2 text-xs leading-5 text-surface-muted">{t("finalResultHint")}</p>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-surface-border pt-3 text-sm dark:border-zinc-700">
              <span className="text-zinc-700 dark:text-zinc-300">{t("collectedFromSales")}</span>
              <span className="font-medium tabular-nums">
                {money(row.salesMinor - row.receivableMinor)}
              </span>
            </div>
            <p className="mt-1 text-xs text-surface-muted">{t("collectedHint")}</p>
          </section>
        </Card>

        {/* Card 2 — Activity trio: sales · count · average · to-collect. */}
        <Card title={t("activityCard")} contentClassName="space-y-3 p-3 sm:p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <dt className="text-[11px] text-surface-muted">{t("sales")}</dt>
              <dd className="text-sm font-semibold tabular-nums">{money(row.salesMinor)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-surface-muted">{t("salesCount")}</dt>
              <dd className="text-sm font-semibold tabular-nums">{String(row.saleCount)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-surface-muted">{t("averageSale")}</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {row.averageSaleMinor === null ? t("notAvailable") : money(row.averageSaleMinor)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-surface-muted">{t("toCollect")}</dt>
              <dd className="text-sm font-semibold tabular-nums">{money(row.receivableMinor)}</dd>
              <dd className="text-[11px] text-surface-muted">{t("toCollectHint")}</dd>
            </div>
          </dl>
        </Card>

        {/* Card 3 — Result breakdown in ROWS with a bigger text: the full
            result narrative — sales · cost · after-products · expenses ·
            result — plus the incompleteness note (same narrative). Founder
            2026-10-31: should include sales, expenses AND the registered
            result, as its name implies. */}
        <Card title={t("breakdownCard")} contentClassName="space-y-1 p-3 sm:p-4">
          <dl className="divide-y divide-surface-border dark:divide-zinc-700">
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-sm text-zinc-700 dark:text-zinc-300">{t("sales")}</dt>
              <dd className="text-sm font-semibold tabular-nums">{money(row.salesMinor)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-sm text-zinc-700 dark:text-zinc-300">{t("cost")}</dt>
              <dd className="text-sm font-semibold tabular-nums">{money(row.knownCostMinor)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-sm text-zinc-700 dark:text-zinc-300">{t("leftAfterProducts")}</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {row.grossProfitMinor === null ? t("needsCost") : money(row.grossProfitMinor)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-sm text-zinc-700 dark:text-zinc-300">{t("expenses")}</dt>
              <dd className="text-sm font-semibold tabular-nums">{money(row.expensesMinor)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className="text-sm font-medium text-zinc-900 dark:text-white">
                {t("resultLine")}
              </dt>
              <dd
                className={`text-base font-semibold tabular-nums ${
                  row.registeredResultMinor === null
                    ? "text-warning"
                    : row.registeredResultMinor > 0
                      ? "text-income"
                      : row.registeredResultMinor < 0
                        ? "text-expense"
                        : "text-zinc-900 dark:text-white"
                }`}
              >
                {row.registeredResultMinor === null
                  ? t("needsCost")
                  : row.registeredResultMinor >= 0
                    ? `+${money(row.registeredResultMinor)}`
                    : money(row.registeredResultMinor)}
              </dd>
            </div>
          </dl>
          {row.incompleteSales > 0 && (
            <p className="mt-3 rounded-md bg-warning/10 p-3 text-sm">
              {t("incompleteHint", { count: String(row.incompleteSales) })}
            </p>
          )}
        </Card>

        {/* Card 4 — top sold as an acotada table (same pattern as the other
            Resumen tables — never full-bleed); the card renders the table's
            own title. */}
        <Card>
          {row.topItems.length > 0 ? (
            <SummaryTable
              title={t("topItems")}
              rows={row.topItems.map((item, index) => ({
                label: `${index + 1}. ${item.name}`,
                value: item.salesMinor,
                currency: row.currency,
              }))}
              totals={toTotals(
                row.topItems.map((item) => ({
                  label: item.name,
                  value: item.salesMinor,
                  currency: row.currency,
                })),
              )}
              locale={locale}
              emptyMessage={t("empty")}
            />
          ) : (
            <p className="text-sm text-surface-muted">{t("empty")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Per-currency totals of a row subset (same convention as the Top tables —
 * COP-first, never summed cross-currency). */
function toTotals(
  rows: Array<{ label: string; value: number; currency: string }>,
): CurrencyTotal[] {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.value);
  }
  return Array.from(byCurrency.entries())
    .sort((a, b) => (a[0] === "COP" ? -1 : b[0] === "COP" ? 1 : a[0].localeCompare(b[0])))
    .map(([currency, value]) => ({ currency, value }));
}
