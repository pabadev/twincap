import type { Movement } from "../domain/movement";
import { countsTowardEconomicResult } from "./economic-result";

export interface CategoryAmount {
  categoryId: string;
  amount: number;
}

export interface CategorySummaryResult {
  incomeCategories: CategoryAmount[];
  expenseCategories: CategoryAmount[];
  totalIncome: number;
  totalExpenses: number;
}

export function computeCategorySummary(input: {
  movements: Movement[];
  currency: string;
}): CategorySummaryResult {
  const { movements, currency } = input;
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  for (const m of movements) {
    if (!countsTowardEconomicResult(m)) continue;
    if (m.amount.currency !== currency) continue;

    if (m.type === "income") {
      incomeMap.set(m.categoryId, (incomeMap.get(m.categoryId) ?? 0) + m.amount.amount);
    } else {
      expenseMap.set(m.categoryId, (expenseMap.get(m.categoryId) ?? 0) + m.amount.amount);
    }
  }

  const toSortedArray = (map: Map<string, number>): CategoryAmount[] =>
    Array.from(map.entries())
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount);

  const incomeCategories = toSortedArray(incomeMap);
  const expenseCategories = toSortedArray(expenseMap);
  const totalIncome = incomeCategories.reduce((s, c) => s + c.amount, 0);
  const totalExpenses = expenseCategories.reduce((s, c) => s + c.amount, 0);

  return { incomeCategories, expenseCategories, totalIncome, totalExpenses };
}
