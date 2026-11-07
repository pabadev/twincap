import { describe, expect, it } from "vitest";
import { toFinancialSummaryCurrencyRows } from "./financial-summary-rows";
import type { PeriodComparisonRow } from "@/core/application/dashboard/compute-period-comparison";

function row(overrides: Partial<PeriodComparisonRow> = {}): PeriodComparisonRow {
  return {
    currency: "COP",
    income: 240000,
    expenses: 561200,
    result: -321200,
    prevIncome: 2196000,
    prevExpenses: 3747830,
    prevResult: -1551830,
    incomeDelta: -1956000,
    expenseDelta: -3186630,
    resultDelta: 1230630,
    incomePct: -0.89,
    expensePct: -0.85,
    resultPct: 0.79,
    ...overrides,
  };
}

describe("toFinancialSummaryCurrencyRows", () => {
  it("null comparison yields an empty row list", () => {
    expect(toFinancialSummaryCurrencyRows(null)).toEqual([]);
  });

  it("carries the ISO-4217 decimals per currency (COP=0, USD=2) — the contract fix", () => {
    const rows = toFinancialSummaryCurrencyRows([
      row({ currency: "COP" }),
      row({ currency: "USD" }),
    ]);
    expect(rows.map((r) => [r.currency, r.decimals])).toEqual([
      ["COP", 0],
      ["USD", 2],
    ]);
  });

  it("maps unknown currencies to decimals=null — never a guessed scale", () => {
    const rows = toFinancialSummaryCurrencyRows([row({ currency: "XYZ" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].decimals).toBeNull();
    expect(rows[0].currency).toBe("XYZ");
    expect(rows[0].incomeMinorUnits).toBe(240000);
  });

  it("passes every minor-unit field through untouched (pure, no formatting)", () => {
    const [out] = toFinancialSummaryCurrencyRows([row()]);
    expect(out.incomeMinorUnits).toBe(240000);
    expect(out.expensesMinorUnits).toBe(561200);
    expect(out.resultMinorUnits).toBe(-321200);
    expect(out.previousIncomeMinorUnits).toBe(2196000);
    expect(out.previousExpensesMinorUnits).toBe(3747830);
    expect(out.previousResultMinorUnits).toBe(-1551830);
    expect(out.incomeDeltaMinorUnits).toBe(-1956000);
    expect(out.expenseDeltaMinorUnits).toBe(-3186630);
    expect(out.resultDeltaMinorUnits).toBe(1230630);
    expect(out.incomeChangeRatio).toBe(-0.89);
    expect(out.expenseChangeRatio).toBe(-0.85);
    expect(out.resultChangeRatio).toBe(0.79);
  });

  it("null per-metric ratios stay null (no fabricated percentages)", () => {
    const [out] = toFinancialSummaryCurrencyRows([
      row({ incomePct: null, expensePct: null, resultPct: null }),
    ]);
    expect(out.incomeChangeRatio).toBeNull();
    expect(out.expenseChangeRatio).toBeNull();
    expect(out.resultChangeRatio).toBeNull();
  });
});
