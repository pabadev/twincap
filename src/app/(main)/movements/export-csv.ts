import type { SerializedMovement } from '../../../core/domain/movement';
import { businessDateToInputValue } from '../../../lib/date';
import { buildCsv, minorUnitsToDecimal } from '../../../lib/csv';

export interface MovementCsvFilters {
  accountId?: string; // 'all' | account id
  scope?: 'all' | 'Personal' | 'Business';
  type?: 'all' | 'income' | 'expense';
}

/**
 * Pure: keeps the movements matching the given CSV export filters, preserving
 * the input order (no re-sort). Mirrors the movements-list client-side filter
 * semantics: the scope filter only applies while 'all accounts' is selected —
 * with a concrete account selected, the account's own scope governs.
 */
export function filterMovementsForCsv(
  movements: SerializedMovement[],
  filters: MovementCsvFilters,
): SerializedMovement[] {
  return movements.filter((m) => {
    if (
      filters.accountId &&
      filters.accountId !== 'all' &&
      m.accountId !== filters.accountId
    ) {
      return false;
    }
    if (
      (!filters.accountId || filters.accountId === 'all') &&
      filters.scope &&
      filters.scope !== 'all' &&
      m.context !== filters.scope
    ) {
      return false;
    }
    if (filters.type && filters.type !== 'all' && m.type !== filters.type) {
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
    m.type === 'income' ? labels.income : labels.expense,
    refs.accountNames[m.accountId] ?? m.accountId,
    refs.categoryNames[m.categoryId] ?? labels.noCategory,
    minorUnitsToDecimal(m.signedAmount, m.amount.currency),
    m.amount.currency,
    m.note ?? '',
  ]);
  return buildCsv(headers, rows);
}