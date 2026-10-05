"use client";

import { Card } from "../ui/card";
import { Icon } from "../ui/icon";
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, User, Briefcase } from "lucide-react";
import { useT } from "../../i18n/client";
import { formatAmount, formatAmountParts } from "../../lib/format";
import { DEFAULT_CURRENCY } from "../../core/domain/currency";
import type {
  ContextSummary,
  ContextCurrencySummary,
} from "../../core/application/compute-context-summary";
import type {
  FinancingTotals,
  DashboardPeriod,
  PeriodComparisonRow,
} from "../../core/application/dashboard/dashboard-types";
// R14-K §14c: the breakdown type lives in core; re-exported here so the
// presentation layer keeps its stable import path.
import type { CurrencyBreakdown } from "../../core/application/dashboard/dashboard-types";
export type { CurrencyBreakdown } from "../../core/application/dashboard/dashboard-types";

/**
 * A2 (F4): renders a money value with the currency suffix in its own
 * whitespace-nowrap span so it never wraps alone at narrow widths.
 */
function MoneyValue({
  amount,
  currency,
  locale,
  sign,
  className,
}: {
  amount: number;
  currency: string;
  locale: string;
  sign?: string;
  className?: string;
}) {
  const parts = formatAmountParts(amount, currency, locale);
  // A sign passed by the caller (modifier like +/−) is a PRESENTATION
  // modifier: with a zero amount it would mint "−0 COP", so it is suppressed
  // — zero is neither income nor expense.
  const effectiveSign = amount === 0 ? "" : sign;
  return (
    <span className={className}>
      {effectiveSign}
      {parts.sign}
      {parts.suffixFirst ? (
        <>
          <span className="whitespace-nowrap shrink-0">{parts.suffix}</span>{" "}
          <span>{parts.amount}</span>
        </>
      ) : (
        <>
          <span>{parts.amount}</span>{" "}
          <span className="whitespace-nowrap shrink-0">{parts.suffix}</span>
        </>
      )}
    </span>
  );
}

interface SummaryCardsProps {
  currency: string;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Financing capital inflow of the current month, in `currency` minor units. */
  financingInflow: number;
  /** Financing capital outflow of the current month, in `currency` minor units. */
  financingOutflow: number;
  /**
   * Per-currency financing breakdown of the current month (beta round 3).
   * When more than one currency appears, the card switches to the
   * per-currency rendering; mono-currency keeps the historical compact form.
   */
  financingBreakdown?: FinancingTotals[];
  locale: string;
  currencyBreakdown?: CurrencyBreakdown[];
  /** Personal/Business split (A6) — rendered below the total cards when present. */
  contextSummary?: ContextSummary;
  /** §6: period granularity (pre-beta). Defaults to "month" (baseline). */
  period?: "month" | "year";
  /** §5.1: per-currency current-vs-previous comparison (server-computed). */
  periodComparison?: PeriodComparisonRow[];
}

/**
 * §5.1 (pre-beta): compact per-currency delta line under the Ingresos/Gastos
 * cards. Each segment compares its currency with ITSELF (never cross-summed):
 * `▲/▼ 12%` vs the previous period of the same duration; when the previous
 * period has no comparable base the segment shows the absolute delta
 * formatted instead of a percentage. The glyph is aria-hidden and a
 * visually-hidden sentence carries the full meaning (accessible + safe).
 */
function PeriodDeltaSegments({
  rows,
  field,
  period,
  locale,
  defaultCurrency,
}: {
  rows: PeriodComparisonRow[];
  field: "income" | "expenses";
  period: "month" | "year";
  locale: string;
  defaultCurrency: string;
}) {
  const t = useT("Dashboard");
  const ref = period === "month" ? t("prevPeriodMonthRef") : t("prevPeriodYearRef");
  // Founder rule (2026-10-02): a comparison line for a currency the user did
  // NOT move in the selected current period is noise — when NO currency other
  // than the default has movements in the current period, the indicators show
  // ONLY the default currency (previous-period-only rows stay out of sight).
  // When another currency IS active this period, every currency keeps its own
  // segment (per-currency, never cross-summed). Presentation-only filter.
  const otherCurrencyMoved = rows.some(
    (r) => r.currency !== defaultCurrency && (r.income !== 0 || r.expenses !== 0),
  );
  const segments = rows
    .filter((r) => otherCurrencyMoved || r.currency === defaultCurrency)
    .filter((r) => r[field] !== 0 || (field === "income" ? r.prevIncome : r.prevExpenses) !== 0)
    .sort((a, b) =>
      a.currency === "COP" ? -1 : b.currency === "COP" ? 1 : a.currency.localeCompare(b.currency),
    );

  if (segments.length === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
      {segments.map((row) => {
        const delta = field === "income" ? row.incomeDelta : row.expenseDelta;
        const pct = field === "income" ? row.incomePct : row.expensePct;
        const deltaText = formatAmount(Math.abs(delta), row.currency, locale);
        const fullSentence =
          pct !== null
            ? t("prevCompareFull", {
                pct: String(Math.round(Math.abs(pct) * 100)),
                sign: delta >= 0 ? t("prevCompareMore") : t("prevCompareLess"),
                metric: field === "income" ? t("income") : t("expenses"),
                currency: row.currency,
                ref,
              })
            : t("prevCompareNoRefFull", {
                metric: field === "income" ? t("income") : t("expenses"),
                currency: row.currency,
                ref,
              });
        return (
          <span key={row.currency} className="whitespace-nowrap">
            <span aria-hidden="true">
              {pct !== null
                ? `${delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} ${Math.round(Math.abs(pct) * 100)}%`
                : `～ ${(delta >= 0 ? "+" : "−") + deltaText}`}
            </span>
            <span className="sr-only">{fullSentence}</span>
          </span>
        );
      })}
    </p>
  );
}

function MultiCurrencyValue({
  items,
  field,
  sign,
  locale,
  className,
}: {
  items: CurrencyBreakdown[];
  field: "balance" | "income" | "expenses";
  sign?: string;
  locale: string;
  className?: string;
}) {
  if (items.length <= 1) {
    // R15.3.1 P1.3: the mono-currency path is the ONLY place a numeric sum is
    // meaningful. Summing `items[field]` across multiple currencies would mix
    // COP and USD minor units — a financially meaningless value that used to
    // be computed dead (never displayed). Compute it only here, where there
    // is at most one currency to sum.
    const total = items.length === 1 ? items[0][field] : 0;
    return (
      <p className={`text-base sm:text-lg font-semibold leading-tight ${className ?? ""}`}>
        {/* §13: explicit fallback via DEFAULT_CURRENCY — no silent hardcoded string. */}
        <MoneyValue
          amount={total}
          currency={items[0]?.currency ?? DEFAULT_CURRENCY}
          locale={locale}
          sign={sign}
        />
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      {items.map((item) => {
        const val = item[field];
        if (val === 0) return null;
        return (
          <span
            key={item.currency}
            className={`text-xs sm:text-sm font-medium leading-tight ${className ?? ""}`}
          >
            <MoneyValue amount={val} currency={item.currency} locale={locale} sign={sign} />
          </span>
        );
      })}
    </div>
  );
}

/**
 * Personal/Business card body (N1): one entry per currency, COP-first as
 * computed server-side. Mono-currency keeps the historical compact two-line
 * layout exactly; multi-currency renders each currency on its own labelled
 * line with its currency code, so amounts in different currencies cannot be
 * conflated.
 */
function ContextCurrencyRows({
  items,
  locale,
  incomeLabel,
  expensesLabel,
}: {
  items: ContextCurrencySummary[];
  locale: string;
  incomeLabel: string;
  expensesLabel: string;
}) {
  if (items.length === 1) {
    const it = items[0];
    return (
      <>
        <p className="text-[11px] sm:text-xs leading-tight text-income">
          {incomeLabel}:{" "}
          <span className="font-semibold">
            +{formatAmount(it.monthlyIncome, it.currency, locale)}
          </span>
        </p>
        <p className="text-[11px] sm:text-xs leading-tight text-expense">
          {expensesLabel}:{" "}
          <span className="font-semibold">
            −{formatAmount(it.monthlyExpenses, it.currency, locale)}
          </span>
        </p>
      </>
    );
  }
  return (
    <>
      <p className="text-[11px] sm:text-xs leading-tight text-zinc-600">{incomeLabel}:</p>
      {items.map((it) => (
        <p key={it.currency} className="text-[11px] sm:text-xs leading-tight text-income">
          <span className="font-semibold">
            +{formatAmount(it.monthlyIncome, it.currency, locale)}
          </span>{" "}
          <span className="text-zinc-600">{it.currency}</span>
        </p>
      ))}
      <p className="text-[11px] sm:text-xs leading-tight text-zinc-600">{expensesLabel}:</p>
      {items.map((it) => (
        <p key={it.currency} className="text-[11px] sm:text-xs leading-tight text-expense">
          <span className="font-semibold">
            −{formatAmount(it.monthlyExpenses, it.currency, locale)}
          </span>{" "}
          <span className="text-zinc-600">{it.currency}</span>
        </p>
      ))}
    </>
  );
}

/**
 * Financing card body in multi-currency mode (beta round 3): one line per
 * currency with a non-zero principal flow, COP-first (server order). Each
 * amount is SIGNED in its own currency — never summed across currencies,
 * same rule as MultiCurrencyValue above.
 */
function FinancingCurrencyRows({
  items,
  locale,
  receivedLabel,
  grantedLabel,
}: {
  items: FinancingTotals[];
  locale: string;
  receivedLabel: string;
  grantedLabel: string;
}) {
  // Hide the label group when that side has no non-zero flow (e.g. only
  // credits received this month).
  const inflowItems = items.filter((it) => it.inflow !== 0);
  const outflowItems = items.filter((it) => it.outflow !== 0);
  return (
    <>
      {inflowItems.length > 0 && (
        <>
          <p className="text-[11px] sm:text-xs leading-tight text-income">{receivedLabel}:</p>
          {inflowItems.map((it) => (
            <p
              key={`in-${it.currency}`}
              className="text-[11px] sm:text-xs leading-tight text-income"
            >
              <span className="font-semibold">+{formatAmount(it.inflow, it.currency, locale)}</span>{" "}
              <span className="text-zinc-600">{it.currency}</span>
            </p>
          ))}
        </>
      )}
      {outflowItems.length > 0 && (
        <>
          <p className="text-[11px] sm:text-xs leading-tight text-expense">{grantedLabel}:</p>
          {outflowItems.map((it) => (
            <p
              key={`out-${it.currency}`}
              className="text-[11px] sm:text-xs leading-tight text-expense"
            >
              <span className="font-semibold">
                −{formatAmount(it.outflow, it.currency, locale)}
              </span>{" "}
              <span className="text-zinc-600">{it.currency}</span>
            </p>
          ))}
        </>
      )}
      {inflowItems.length === 0 && outflowItems.length === 0 && (
        <p className="text-[11px] sm:text-xs leading-tight text-zinc-600">—</p>
      )}
    </>
  );
}

export function SummaryCards({
  currency,
  monthlyIncome,
  monthlyExpenses,
  financingInflow,
  financingOutflow,
  financingBreakdown,
  locale,
  currencyBreakdown,
  contextSummary,
  period: periodProp,
  periodComparison,
}: SummaryCardsProps) {
  const t = useT("Dashboard");
  const multi = currencyBreakdown && currencyBreakdown.length > 1;
  const period: DashboardPeriod = periodProp ?? "month";
  // A11: the cross-currency `totalBalance` sum is gone. In mono-currency mode
  // the single currency's balance IS the total (the sum of every account
  // balance, all in that currency); multi-currency renders the per-currency
  // breakdown instead. No cross-currency arithmetic anywhere.
  const monoBalance =
    currencyBreakdown && currencyBreakdown.length > 0 ? currencyBreakdown[0].balance : 0;
  const balanceClass = monoBalance < 0 ? "text-expense" : "text-zinc-900 dark:text-zinc-100";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card contentClassName="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-income/10 p-2">
              <Icon icon={TrendingUp} size="md" className="text-income" />
            </div>
            <div className="min-w-0 flex flex-col justify-center sm:justify-start">
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                {period === "month" ? t("incomeThisMonth") : t("incomeThisPeriodYear")}
              </p>
              {multi ? (
                <MultiCurrencyValue
                  items={currencyBreakdown!}
                  field="income"
                  sign="+"
                  locale={locale}
                  className="text-income"
                />
              ) : (
                <p className="text-base sm:text-lg font-semibold text-income leading-tight">
                  <MoneyValue amount={monthlyIncome} currency={currency} locale={locale} sign="+" />
                </p>
              )}
              {periodComparison && (
                <PeriodDeltaSegments
                  rows={periodComparison}
                  field="income"
                  period={period}
                  locale={locale}
                  defaultCurrency={currency}
                />
              )}
            </div>
          </div>
        </Card>

        <Card contentClassName="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-expense/10 p-2">
              <Icon icon={TrendingDown} size="md" className="text-expense" />
            </div>
            <div className="min-w-0 flex flex-col justify-center sm:justify-start">
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                {period === "month" ? t("expensesThisMonth") : t("expensesThisPeriodYear")}
              </p>
              {multi ? (
                <MultiCurrencyValue
                  items={currencyBreakdown!}
                  field="expenses"
                  sign="−"
                  locale={locale}
                  className="text-expense"
                />
              ) : (
                <p className="text-base sm:text-lg font-semibold text-expense leading-tight">
                  <MoneyValue
                    amount={monthlyExpenses}
                    currency={currency}
                    locale={locale}
                    sign="−"
                  />
                </p>
              )}
              {periodComparison && (
                <PeriodDeltaSegments
                  rows={periodComparison}
                  field="expenses"
                  period={period}
                  locale={locale}
                  defaultCurrency={currency}
                />
              )}
            </div>
          </div>
        </Card>

        <Card contentClassName="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-info/10 p-2">
              <Icon icon={Wallet} size="md" className="text-info" />
            </div>
            <div className="min-w-0 flex flex-col justify-center sm:justify-start">
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                {t("totalBalance")}
              </p>
              {multi ? (
                <MultiCurrencyValue
                  items={currencyBreakdown!}
                  field="balance"
                  locale={locale}
                  className="text-zinc-900 dark:text-zinc-100"
                />
              ) : (
                <p className={`text-base sm:text-lg font-semibold leading-tight ${balanceClass}`}>
                  <MoneyValue amount={monoBalance} currency={currency} locale={locale} />
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card contentClassName="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-info/10 p-2">
              <Icon icon={ArrowLeftRight} size="md" className="text-info" />
            </div>
            <div className="min-h-[3.5rem] min-w-0 flex flex-col justify-center sm:justify-start gap-0.5">
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                {period === "month" ? t("financingThisMonth") : t("financingThisPeriodYear")}
              </p>
              {financingBreakdown && financingBreakdown.length > 1 ? (
                <FinancingCurrencyRows
                  items={financingBreakdown}
                  locale={locale}
                  receivedLabel={t("financingReceived")}
                  grantedLabel={t("financingGranted")}
                />
              ) : (
                <>
                  <p className="text-[11px] sm:text-xs leading-tight text-income">
                    {t("financingReceived")}:{" "}
                    <span className="font-semibold">
                      <MoneyValue
                        amount={financingInflow}
                        currency={currency}
                        locale={locale}
                        sign="+"
                      />
                    </span>
                  </p>
                  <p className="text-[11px] sm:text-xs leading-tight text-expense">
                    {t("financingGranted")}:{" "}
                    <span className="font-semibold">
                      <MoneyValue
                        amount={financingOutflow}
                        currency={currency}
                        locale={locale}
                        sign="−"
                      />
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* A6/N1: Personal / Business split of the current-month result, per
          currency — shown only while no context filter is active (scope 'all',
          server-populated). */}
      {(contextSummary?.personal || contextSummary?.business) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {contextSummary.personal && (
            <Card contentClassName="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
                <div className="shrink-0 rounded-lg bg-income/10 p-2">
                  <Icon icon={User} size="md" className="text-income" />
                </div>
                <div className="min-h-[3.5rem] min-w-0 flex flex-col justify-center sm:justify-start gap-0.5">
                  <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                    {t("filterScopePersonal")}
                  </p>
                  <ContextCurrencyRows
                    items={contextSummary.personal}
                    locale={locale}
                    incomeLabel={t("income")}
                    expensesLabel={t("expenses")}
                  />
                </div>
              </div>
            </Card>
          )}
          {contextSummary.business && (
            <Card contentClassName="p-3 sm:p-4">
              <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
                <div className="shrink-0 rounded-lg bg-income/10 p-2">
                  <Icon icon={Briefcase} size="md" className="text-income" />
                </div>
                <div className="min-h-[3.5rem] min-w-0 flex flex-col justify-center sm:justify-start gap-0.5">
                  <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                    {t("filterScopeBusiness")}
                  </p>
                  <ContextCurrencyRows
                    items={contextSummary.business}
                    locale={locale}
                    incomeLabel={t("income")}
                    expensesLabel={t("expenses")}
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
