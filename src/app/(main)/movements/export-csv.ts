import type { SerializedMovement } from "../../../core/domain/movement";
import { businessDateToInputValue } from "../../../lib/date";
import { buildCsv, minorUnitsToDecimal } from "../../../lib/csv";

export interface MovementCsvFilters {
  accountId?: string; // 'all' | account id
  scope?: "all" | "Personal" | "Business";
  type?: "all" | "income" | "expense";
  dateFrom?: string; // YYYY-MM-DD civil date, inclusive
  dateTo?: string; // YYYY-MM-DD civil date, inclusive
  categoryId?: string; // 'all' | category id
}

/**
 * Pure: keeps the movements matching the given CSV export filters, preserving
 * the input order (no re-sort). Mirrors the movements-list client-side filter
 * semantics (UX-7 tabs): the scope filter applies ALWAYS (it is the tab), AND
 * the account/date/category/type subfilters narrow within it.
 */
export function filterMovementsForCsv(
  movements: SerializedMovement[],
  filters: MovementCsvFilters,
): SerializedMovement[] {
  return movements.filter((m) => {
    if (filters.accountId && filters.accountId !== "all" && m.accountId !== filters.accountId) {
      return false;
    }
    if (filters.scope && filters.scope !== "all" && m.context !== filters.scope) {
      return false;
    }
    if (filters.type && filters.type !== "all" && m.type !== filters.type) {
      return false;
    }
    if (filters.categoryId && filters.categoryId !== "all" && m.categoryId !== filters.categoryId) {
      return false;
    }
    if (filters.dateFrom && businessDateToInputValue(m.date) < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && businessDateToInputValue(m.date) > filters.dateTo) {
      return false;
    }
    return true;
  });
}

/**
 * Pure: turns serialized movements + resolved name maps + localized labels
 * into CSV text. Amounts use signedAmount directly (income positive, expense
 * negative). Sort is preserved (repo order) — no re-sorting here.
 */
export function buildMovementsCsv(
  movements: SerializedMovement[],
  refs: {
    accountNames: Record<string, string>;
    categoryNames: Record<string, string>;
  },
  labels: {
    income: string;
    expense: string;
    date: string;
    type: string;
    account: string;
    category: string;
    amount: string;
    currency: string;
    note: string;
    noCategory: string;
  },
): string {
  const headers = [
    labels.date,
    labels.type,
    labels.account,
    labels.category,
    labels.amount,
    labels.currency,
    labels.note,
  ];
  const rows = movements.map((m) => [
    businessDateToInputValue(m.date),
    m.type === "income" ? labels.income : labels.expense,
    refs.accountNames[m.accountId] ?? m.accountId,
    refs.categoryNames[m.categoryId] ?? labels.noCategory,
    minorUnitsToDecimal(m.signedAmount, m.amount.currency),
    m.amount.currency,
    m.note ?? "",
  ]);
  return buildCsv(headers, rows);
}
