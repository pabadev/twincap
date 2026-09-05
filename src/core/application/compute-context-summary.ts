import type { Movement } from "../domain/movement";
import type { Currency } from "../domain/currency";
import { countsTowardEconomicResult } from "./economic-result";

/** UTC year-month key of a date — business dates are midnight-UTC civil dates (D1). */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** One currency's slice of a Personal/Business current-month economic result. */
export interface ContextCurrencySummary {
  /** ISO 4217 currency code of this entry. */
  currency: Currency;
  /** Economic income of the current calendar month, in this currency. */
  monthlyIncome: number;
  /** Economic expenses of the current calendar month, in this currency. */
  monthlyExpenses: number;
}

export interface ContextSummary {
  /**
   * Present only when the Personal context has current-month movements that
   * count toward the economic result — one entry per currency with data.
   * Empty sections never render (A6, Fase 3 pre-beta audit). Entries are
   * sorted COP-first, then alphabetically (same convention as the dashboard's
   * `currencyBreakdown`), so the UI order is deterministic.
   */
  personal?: ContextCurrencySummary[];
  /** Same rule as `personal`; legacy movements without context are Personal. */
  business?: ContextCurrencySummary[];
}

/**
 * Split the current-month economic result by Movement.context × currency
 * (N1, Fase 5 pre-beta audit).
 *
 * Pure helper over already-filtered movements, sharing the exact semantics of
 * the total cards: `countsTowardEconomicResult` (transfers/opening/financing
 * capital/standalone abonos excluded, sale-born Business abonos included) and
 * the current calendar month anchored on the client's CIVIL date
 * (`now` + `tzOffsetMinutes`, same A2 pattern as `computeDashboardSummary`).
 *
 * Per context, amounts are aggregated per currency — there is NO single
 * currency scope: a USD movement yields its own USD entry alongside COP
 * (previously it was silently dropped). Each entry is included only when at
 * least one of monthlyIncome/monthlyExpenses is non-zero.
 *
 * Legacy movements without a context are grouped as Personal — this matches
 * the domain factory default and the business reality that pre-context
 * movements are personal activity.
 */
export function computeContextSummary(input: {
  movements: Movement[];
  /** Reference instant for the "current month"; defaults to the real clock. */
  now?: Date;
  /**
   * `new Date().getTimezoneOffset()` of the requesting client (300 for UTC-5,
   * -60 for UTC+1). Shifts `now` to the client's civil date before deriving
   * the current-month key. Default 0 = UTC (server clock).
   */
  tzOffsetMinutes?: number;
}): ContextSummary {
  const { movements } = input;
  const now = input.now ?? new Date();
  const civilNow = new Date(
    now.getTime() - (input.tzOffsetMinutes ?? 0) * 60_000,
  );
  const currentKey = utcMonthKey(civilNow);

  const byContext = new Map<
    'Personal' | 'Business',
    Map<Currency, { income: number; expenses: number }>
  >();

  for (const m of movements) {
    if (!countsTowardEconomicResult(m)) continue;
    if (utcMonthKey(m.date) !== currentKey) continue;
    const ctx = m.context ?? 'Personal';
    const cur = m.amount.currency;
    let byCurrency = byContext.get(ctx);
    if (!byCurrency) {
      byCurrency = new Map();
      byContext.set(ctx, byCurrency);
    }
    const entry = byCurrency.get(cur) ?? { income: 0, expenses: 0 };
    if (m.type === 'income') entry.income += m.amount.amount;
    else entry.expenses += m.amount.amount;
    byCurrency.set(cur, entry);
  }

  const result: ContextSummary = {};
  const pushSection = (
    ctx: 'Personal' | 'Business',
    key: 'personal' | 'business',
  ) => {
    const byCurrency = byContext.get(ctx);
    if (!byCurrency || byCurrency.size === 0) return;
    const items = Array.from(byCurrency.entries())
      .map(([currency, { income, expenses }]) => ({
        currency,
        monthlyIncome: income,
        monthlyExpenses: expenses,
      }))
      .filter((it) => it.monthlyIncome !== 0 || it.monthlyExpenses !== 0)
      .sort((a, b) =>
        a.currency === 'COP'
          ? -1
          : b.currency === 'COP'
            ? 1
            : a.currency.localeCompare(b.currency),
      );
    if (items.length > 0) result[key] = items;
  };
  pushSection('Personal', 'personal');
  pushSection('Business', 'business');
  return result;
}