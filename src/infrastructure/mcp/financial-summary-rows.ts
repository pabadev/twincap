/**
 * Row mapper for the MCP `personal.get_financial_summary` tool output.
 *
 * Contract fix (2026-11-07): amounts are integer minor units per ISO 4217,
 * but "minor units" alone is ambiguous for consumers — COP uses exponent 0
 * (whole pesos) while USD/MXN/EUR/BRL use exponent 2 (cents). A consumer
 * that assumes a universal /100 silently mis-scales every COP figure.
 * Each row therefore carries `decimals` (= the currency's ISO-4217 decimal
 * places), sourced from the same domain table the whole app uses; unknown
 * currencies map to `null` (never guess).
 *
 * Pure — no I/O, no formatting: presentation is the consumer's job.
 */
import type { PeriodComparisonRow } from "@/core/application/dashboard/compute-period-comparison";
import { CURRENCY_EXPONENTS, type Currency } from "@/core/domain/currency";

/** One per-currency summary row as exposed by the MCP tool. */
export interface FinancialSummaryCurrencyRow {
  currency: Currency;
  /**
   * ISO-4217 decimal places: main-unit amount = minorUnits / 10^decimals.
   * COP=0 (whole pesos — amounts already exact for display), USD/MXN/EUR/BRL=2
   * (divide by 100). `null` only for a currency outside the domain table —
   * consumers must never guess a scale.
   */
  decimals: number | null;
  incomeMinorUnits: number;
  expensesMinorUnits: number;
  resultMinorUnits: number;
  previousIncomeMinorUnits: number;
  previousExpensesMinorUnits: number;
  previousResultMinorUnits: number;
  incomeDeltaMinorUnits: number;
  expenseDeltaMinorUnits: number;
  resultDeltaMinorUnits: number;
  incomeChangeRatio: number | null;
  expenseChangeRatio: number | null;
  resultChangeRatio: number | null;
}

/** Unknown/unsupported currencies must not reach the contract with a guessed scale. */
function decimalsOf(currency: string): number | null {
  if (!isKnownExponentCurrency(currency)) return null;
  return CURRENCY_EXPONENTS[currency];
}

function isKnownExponentCurrency(currency: string): currency is Currency {
  return currency in CURRENCY_EXPONENTS;
}

export function toFinancialSummaryCurrencyRows(
  rows: PeriodComparisonRow[] | null,
): FinancialSummaryCurrencyRow[] {
  if (!rows) return [];
  return rows.map((row) => ({
    currency: row.currency as Currency,
    decimals: decimalsOf(row.currency),
    incomeMinorUnits: row.income,
    expensesMinorUnits: row.expenses,
    resultMinorUnits: row.result,
    previousIncomeMinorUnits: row.prevIncome,
    previousExpensesMinorUnits: row.prevExpenses,
    previousResultMinorUnits: row.prevResult,
    incomeDeltaMinorUnits: row.incomeDelta,
    expenseDeltaMinorUnits: row.expenseDelta,
    resultDeltaMinorUnits: row.resultDelta,
    incomeChangeRatio: row.incomePct,
    expenseChangeRatio: row.expensePct,
    resultChangeRatio: row.resultPct,
  }));
}
