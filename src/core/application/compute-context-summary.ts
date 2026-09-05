import type { Movement } from "../domain/movement";
import { countsTowardEconomicResult } from "./economic-result";

/** UTC year-month key of a date — business dates are midnight-UTC civil dates (D1). */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface ContextMonthlySummary {
  /** Economic income of the current calendar month, in the scope currency. */
  monthlyIncome: number;
  /** Economic expenses of the current calendar month, in the scope currency. */
  monthlyExpenses: number;
}

export interface ContextSummary {
  /**
   * Present only when the Personal context has movements in the filtered set
   * AND at least one of them counts toward the economic result — empty
   * sections never render (A6, Fase 3 pre-beta audit).
   */
  personal?: ContextMonthlySummary;
  /** Same rule as `personal`; legacy movements without context are Personal. */
  business?: ContextMonthlySummary;
}

/**
 * Split the current-month economic result by Movement.context (A6).
 *
 * Pure helper over already-filtered movements, sharing the exact semantics of
 * the total cards: ONE currency scope (`currency`), `countsTowardEconomicResult`
 * (transfers/opening/financing capital/standalone abonos excluded,
 * sale-born Business abonos included), and the current calendar month anchored
 * on the client's CIVIL date (`now` + `tzOffsetMinutes`, same A2 pattern as
 * `computeDashboardSummary`).
 *
 * Legacy movements without a context are grouped as Personal — this matches
 * the domain factory default and the business reality that pre-context
 * movements are personal activity.
 */
export function computeContextSummary(input: {
  movements: Movement[];
  /** Currency scope — amounts in other currencies are ignored. */
  currency: string;
  /** Reference instant for the "current month"; defaults to the real clock. */
  now?: Date;
  /**
   * `new Date().getTimezoneOffset()` of the requesting client (300 for UTC-5,
   * -60 for UTC+1). Shifts `now` to the client's civil date before deriving
   * the current-month key. Default 0 = UTC (server clock).
   */
  tzOffsetMinutes?: number;
}): ContextSummary {
  const { movements, currency } = input;
  const now = input.now ?? new Date();
  const civilNow = new Date(
    now.getTime() - (input.tzOffsetMinutes ?? 0) * 60_000,
  );
  const currentKey = utcMonthKey(civilNow);

  const byContext = new Map<
    'Personal' | 'Business',
    { hasAny: boolean; income: number; expenses: number }
  >();

  for (const m of movements) {
    const ctx = m.context ?? 'Personal';
    let entry = byContext.get(ctx);
    if (!entry) {
      entry = { hasAny: false, income: 0, expenses: 0 };
      byContext.set(ctx, entry);
    }
    entry.hasAny = true;
    if (!countsTowardEconomicResult(m)) continue;
    if (m.amount.currency !== currency) continue;
    if (utcMonthKey(m.date) !== currentKey) continue;
    if (m.type === 'income') entry.income += m.amount.amount;
    else entry.expenses += m.amount.amount;
  }

  const result: ContextSummary = {};
  const pushSection = (
    ctx: 'Personal' | 'Business',
    key: 'personal' | 'business',
  ) => {
    const entry = byContext.get(ctx);
    if (entry && entry.hasAny && (entry.income !== 0 || entry.expenses !== 0)) {
      result[key] = {
        monthlyIncome: entry.income,
        monthlyExpenses: entry.expenses,
      };
    }
  };
  pushSection('Personal', 'personal');
  pushSection('Business', 'business');
  return result;
}