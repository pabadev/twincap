import type { Movement } from '../domain/movement';
import { countsTowardEconomicResult } from './economic-result';

/** UTC year-month key of a date — business dates are midnight-UTC civil dates. */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface YearMonthBucket {
  month: string;
  income: number;
  expenses: number;
}

export interface YearlyEvolutionResult {
  /** 12 months of the year, oldest first. Months with no data show zeros. */
  months: YearMonthBucket[];
}

/**
 * Compute 12-month income vs expenses series for a given year.
 *
 * Used for the yearly evolution chart — shows income and expenses as
 * separate series across 12 months. Internal flows (transfers, opening
 * balances) and financing capital (credit principals) are excluded.
 *
 * Pure function: takes already-loaded movements and a target year,
 * returns bucketed data for chart rendering.
 */
export function computeYearlyEvolution(input: {
  movements: Movement[];
  /** Currency scope — amounts in other currencies are ignored. */
  currency: string;
  /**
   * Year to compute. When provided explicitly it is used as-is (the user's
   * chart selection); otherwise it defaults to the civil year of the
   * reference instant (A2), so December 31 evenings in UTC-5 do not roll
   * into the next year.
   */
  year?: number;
  /** Reference instant for the default year; defaults to the real clock. */
  now?: Date;
  /**
   * `new Date().getTimezoneOffset()` of the requesting client (300 for UTC-5,
   * -60 for UTC+1). Shifts `now` to the client's civil date before deriving
   * the default year. Default 0 = UTC (server clock).
   */
  tzOffsetMinutes?: number;
}): YearlyEvolutionResult {
  const { movements, currency } = input;
  const now = input.now ?? new Date();
  const civilNow = new Date(
    now.getTime() - (input.tzOffsetMinutes ?? 0) * 60_000,
  );
  const year = input.year ?? civilNow.getUTCFullYear();

  const monthMap = new Map<string, { income: number; expenses: number }>();

  for (const m of movements) {
    if (!countsTowardEconomicResult(m)) continue;
    if (m.amount.currency !== currency) continue;

    const dateYear = m.date.getUTCFullYear();
    if (dateYear !== year) continue;

    const key = utcMonthKey(m.date);
    const bucket = monthMap.get(key) ?? { income: 0, expenses: 0 };
    if (m.type === 'income') bucket.income += m.amount.amount;
    else bucket.expenses += m.amount.amount;
    monthMap.set(key, bucket);
  }

  const months: YearMonthBucket[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(year, i, 1));
    const key = utcMonthKey(d);
    const bucket = monthMap.get(key) ?? { income: 0, expenses: 0 };
    months.push({ month: key, ...bucket });
  }

  return { months };
}
