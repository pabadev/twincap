import type { SerializedSale } from '../../../../core/domain/sale';
import { businessDateToInputValue } from '../../../../lib/date';
import { buildCsv, minorUnitsToDecimal } from '../../../../lib/csv';

export interface SaleCsvFilters {
  dateFrom?: string; // 'YYYY-MM-DD' inclusive
  dateTo?: string; // 'YYYY-MM-DD' inclusive
  status?: 'all' | 'paid' | 'credit';
  search?: string; // client name substring (case-insensitive)
}

/**
 * Pure: keeps the sales matching the given CSV export filters, preserving the
 * input order. Dates are compared as civil-date strings (YYYY-MM-DD, inclusive).
 * Status 'paid' means fully paid (pending === 0); 'credit' means outstanding
 * (pending > 0). Search filters the resolved client name (walk-in sales have
 * no client name and are excluded by a non-empty search, matching the list UI).
 */
export function filterSalesForCsv(
  sales: SerializedSale[],
  filters: SaleCsvFilters,
  clientNames: Record<string, string>,
): SerializedSale[] {
  return sales.filter((s) => {
    const businessDate = businessDateToInputValue(s.date);
    if (filters.dateFrom && businessDate < filters.dateFrom) return false;
    if (filters.dateTo && businessDate > filters.dateTo) return false;
    if (filters.status === 'paid' && s.pending !== 0) return false;
    if (filters.status === 'credit' && s.pending <= 0) return false;
    if (filters.search) {
      const clientName = s.clientId ? (clientNames[s.clientId] ?? '') : '';
      if (!clientName.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Pure: turns serialized sales + resolved name maps + localized labels into
 * CSV text. The currency comes from the first line item's unitPrice — the
 * same canonical source as the sale-list UI. NO silent 'COP' fallback
 * (R15.3.2 P2-2): a sale always has at least one line item, so a missing
 * currency means the record is corrupt and the export fails LOUD instead of
 * misreporting every amount.
 */
export function buildSalesCsv(
  sales: SerializedSale[],
  refs: {
    clientNames: Record<string, string>;
    itemNames: Record<string, string>;
  },
  labels: {
    date: string;
    client: string;
    items: string;
    total: string;
    paid: string;
    pending: string;
    currency: string;
    paymentMode: string;
    paidInFull: string;
    onCredit: string;
    noClient: string;
  },
): string {
  const headers = [
    labels.date,
    labels.client,
    labels.items,
    labels.total,
    labels.paid,
    labels.pending,
    labels.currency,
    labels.paymentMode,
  ];
  const rows = sales.map((s) => {
    // R15.3.2 P2-2: never a silent COP default — a sale always has >= 1 line
    // item, so a missing currency is a corrupt record and must fail loudly.
    const currency = s.items[0]?.unitPrice.currency ?? (() => {
      throw new Error(`Sale ${s.id} has no line items — cannot resolve currency for CSV export`);
    })();
    const itemsSummary = s.items
      .map((li) => `${li.quantity}× ${refs.itemNames[li.itemId] ?? li.itemId}`)
      .join(', ');
    return [
      businessDateToInputValue(s.date),
      s.clientId ? (refs.clientNames[s.clientId] ?? labels.noClient) : labels.noClient,
      itemsSummary,
      minorUnitsToDecimal(s.total, currency),
      minorUnitsToDecimal(s.total - s.pending, currency),
      minorUnitsToDecimal(s.pending, currency),
      currency,
      s.paymentMode === 'paid-in-full' ? labels.paidInFull : labels.onCredit,
    ];
  });
  return buildCsv(headers, rows);
}