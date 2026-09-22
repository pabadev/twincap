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
import type { FinancingTotals } from "../../core/application/dashboard/dashboard-types";
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
  return (
    <span className={className}>
      {sign}
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
          <span className="text-zinc-400">{it.currency}</span>
        </p>
      ))}
      <p className="text-[11px] sm:text-xs leading-tight text-zinc-600">{expensesLabel}:</p>
      {items.map((it) => (
        <p key={it.currency} className="text-[11px] sm:text-xs leading-tight text-expense">
          <span className="font-semibold">
            −{formatAmount(it.monthlyExpenses, it.currency, locale)}
          </span>{" "}
          <span className="text-zinc-400">{it.currency}</span>
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
              <span className="text-zinc-400">{it.currency}</span>
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
              <span className="text-zinc-400">{it.currency}</span>
            </p>
          ))}
        </>
      )}
      {inflowItems.length === 0 && outflowItems.length === 0 && (
        <p className="text-[11px] sm:text-xs leading-tight text-zinc-400">—</p>
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
}: SummaryCardsProps) {
  const t = useT("Dashboard");
  const multi = currencyBreakdown && currencyBreakdown.length > 1;
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
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                {t("incomeThisMonth")}
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
            </div>
          </div>
        </Card>

        <Card contentClassName="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-expense/10 p-2">
              <Icon icon={TrendingDown} size="md" className="text-expense" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                {t("expensesThisMonth")}
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
            </div>
          </div>
        </Card>

        <Card contentClassName="p-3 sm:p-4">
          <div className="flex flex-col items-center text-center gap-1.5 sm:flex-row sm:text-left sm:items-center sm:gap-3">
            <div className="shrink-0 rounded-lg bg-info/10 p-2">
              <Icon icon={Wallet} size="md" className="text-info" />
            </div>
            <div className="min-w-0">
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
            <div className="min-w-0 flex flex-col gap-0.5">
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400">
                {t("financingThisMonth")}
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
                <div className="min-w-0 flex flex-col gap-0.5">
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
                <div className="min-w-0 flex flex-col gap-0.5">
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
