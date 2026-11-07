/**
 * Row mappers for the MCP movement-capability tools
 * (personal.list_movements, personal.get_monthly_series).
 *
 * Contract principles mirror ./financial-summary-rows.ts:
 * - amounts stay integer minor units (Stripe-style), `decimals` per row from
 *   the domain's CURRENCY_EXPONENTS table (COP=0, USD/MXN/EUR/BRL=2) so no
 *   consumer can mis-scale a figure;
 * - unknown currencies map to `decimals: null` — never a guessed scale;
 * - pure, no I/O, no formatting: presentation is the consumer's job.
 */
import type { MonthBucket } from "@/core/application/compute-dashboard-summary";
import { CURRENCY_EXPONENTS, type Currency } from "@/core/domain/currency";
import type { SerializedMovement } from "@/core/domain/movement";

/** One per-month economic series row as exposed by personal.get_monthly_series. */
export interface MonthlySeriesRow {
  /** Civil month key ("YYYY-MM") as used by every dashboard aggregator. */
  month: string;
  currency: Currency;
  decimals: number | null;
  incomeMinorUnits: number;
  expensesMinorUnits: number;
  /** income − expenses for the month, signed. */
  resultMinorUnits: number;
}

/** One movement row as exposed by personal.list_movements. */
export interface MovementToolRow {
  id: string;
  /** ISO-8601 instant of the movement date (UTC). */
  date: string;
  type: "income" | "expense";
  /** Signed minor-unit amount: + incomes, − expenses (same convention as signedAmount). */
  amountMinorUnits: number;
  currency: Currency;
  decimals: number | null;
  /** Human label resolved with the same helper the dashboard uses. */
  category: string;
  note: string | null;
  /** Owning account name, when the account still resolves. */
  account: string | null;
}

export interface MovementToolEnvelope {
  rows: MovementToolRow[];
  /** Length of the full filtered list BEFORE the request cap applied. */
  total: number;
  hasMore: boolean;
}

function decimalsOf(currency: string): number | null {
  return currency in CURRENCY_EXPONENTS ? CURRENCY_EXPONENTS[currency as Currency] : null;
}

/** Last `months` buckets (months clamped to the received data), chronological. */
export function toMonthlySeriesRows(
  buckets: MonthBucket[],
  currency: string,
  months: number,
): MonthlySeriesRow[] {
  const slice = buckets.slice(-Math.max(1, months));
  return slice.map((bucket) => ({
    month: bucket.month,
    currency: currency as Currency,
    decimals: decimalsOf(currency),
    incomeMinorUnits: bucket.income,
    expensesMinorUnits: bucket.expenses,
    resultMinorUnits: bucket.income - bucket.expenses,
  }));
}

type CategoryLabelOf = (categoryId: string) => string;
type AccountNameOf = (accountId: string) => string | null;

/**
 * Map serialized movements to MCP rows. Input MUST already be live-parent
 * filtered (same semantics as the dashboard — callers compose with
 * filterMovementsWithLiveParents). Sorted newest first, capped to `limit`;
 * the full length is returned via {@link MovementToolEnvelope}.
 */
export function toMovementToolRows(
  movements: SerializedMovement[],
  currencyByAccount: Map<string, Currency>,
  accountNameOf: AccountNameOf,
  labelOf: CategoryLabelOf,
  opts: { limit: number; type?: "all" | "income" | "expense" },
): MovementToolEnvelope {
  const filtered =
    opts.type && opts.type !== "all" ? movements.filter((m) => m.type === opts.type) : movements;
  const sorted = [...filtered].sort((a, b) => {
    const dateDelta = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDelta !== 0) return dateDelta;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const rows = sorted.slice(0, Math.max(0, opts.limit)).map((m) => {
    const accountCurrency = currencyByAccount.get(m.accountId);
    const currency = (m.amount.currency ?? accountCurrency) as Currency | undefined;
    return {
      id: m.id,
      date: new Date(m.date).toISOString(),
      type: m.type,
      amountMinorUnits: m.signedAmount,
      currency: currency ?? ("COP" as Currency),
      decimals: currency ? decimalsOf(currency) : null,
      category: labelOf(m.categoryId),
      note: m.note ?? null,
      account: accountNameOf(m.accountId),
    };
  });
  return { rows, total: filtered.length, hasMore: sorted.length > rows.length };
}
