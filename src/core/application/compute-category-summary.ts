import type { Movement } from "../domain/movement";
import { countsTowardEconomicResult } from "./economic-result";

export interface CategoryAmount {
  categoryId: string;
  currency: string;
  amount: number;
}

export interface CurrencyTotal {
  currency: string;
  value: number;
}

export interface CategorySummaryResult {
  incomeCategories: CategoryAmount[];
  expenseCategories: CategoryAmount[];
  incomeTotals: CurrencyTotal[];
  expenseTotals: CurrencyTotal[];
}

/** COP-first, then alphabetical — same convention as the dashboard's `currencyBreakdown`. */
function currencyComparator(a: string, b: string): number {
  if (a === "COP") return -1;
  if (b === "COP") return 1;
  return a.localeCompare(b);
}

/**
 * Aggregate the economic result of a movement set by category × currency
 * (R4-A2, Fase 4 pre-beta audit). There is NO single-currency scope anymore:
 * a USD movement yields its own USD row alongside COP instead of being
 * silently dropped. Amounts are never mixed across currencies — each row
 * carries its own `currency` and every total is per-currency.
 *
 * Semantics inherited from the total cards: `countsTowardEconomicResult`
 * (transfers/opening/financing capital/standalone abonos excluded, sale-born
 * Business abonos included), and only movements that count are aggregated.
 */
export function computeCategorySummary(input: {
  movements: Movement[];
}): CategorySummaryResult {
  const { movements } = input;
  const incomeMap = new Map<string, Map<string, number>>();
  const expenseMap = new Map<string, Map<string, number>>();

  for (const m of movements) {
    if (!countsTowardEconomicResult(m)) continue;
    const cur = m.amount.currency;
    const byCurrency = m.type === "income" ? incomeMap : expenseMap;
    let byCategory = byCurrency.get(cur);
    if (!byCategory) {
      byCategory = new Map();
      byCurrency.set(cur, byCategory);
    }
    byCategory.set(
      m.categoryId,
      (byCategory.get(m.categoryId) ?? 0) + m.amount.amount,
    );
  }

  // Rows ordered by currency (COP-first) and, within each currency, by
  // amount descending — the UI renders them grouped by currency so amounts
  // in different currencies can never be conflated.
  const toCategoryRows = (map: Map<string, Map<string, number>>): CategoryAmount[] => {
    const rows: CategoryAmount[] = [];
    const currencies = Array.from(map.keys()).sort(currencyComparator);
    for (const cur of currencies) {
      const categoryRows = Array.from(map.get(cur)!.entries())
        .map(([categoryId, amount]) => ({ categoryId, currency: cur, amount }))
        .sort((a, b) => b.amount - a.amount);
      rows.push(...categoryRows);
    }
    return rows;
  };

  // Totals per currency, COP-first, omitting currencies whose total is 0.
  const toTotals = (map: Map<string, Map<string, number>>): CurrencyTotal[] =>
    Array.from(map.entries())
      .map(([currency, byCategory]) => ({
        currency,
        value: Array.from(byCategory.values()).reduce((s, v) => s + v, 0),
      }))
      .filter((t) => t.value !== 0)
      .sort((a, b) => currencyComparator(a.currency, b.currency));

  return {
    incomeCategories: toCategoryRows(incomeMap),
    expenseCategories: toCategoryRows(expenseMap),
    incomeTotals: toTotals(incomeMap),
    expenseTotals: toTotals(expenseMap),
  };
}