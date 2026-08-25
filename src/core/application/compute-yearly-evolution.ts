import type { Movement, MovementLinkKind } from '../domain/movement';

/**
 * Link kinds that do NOT represent economic result (decision D2).
 * Same set as in compute-dashboard-summary — kept in sync.
 */
const NON_ECONOMIC_LINK_KINDS: ReadonlySet<MovementLinkKind> = new Set([
  'transfer',
  'opening',
] as const);

function countsTowardEconomicResult(movement: Movement): boolean {
  return !(movement.link && NON_ECONOMIC_LINK_KINDS.has(movement.link.kind));
}

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
 * separate series across 12 months. Transfers and opening excluded.
 *
 * Pure function: takes already-loaded movements and a target year,
 * returns bucketed data for chart rendering.
 */
export function computeYearlyEvolution(input: {
  movements: Movement[];
  /** Currency scope — amounts in other currencies are ignored. */
  currency: string;
  /** Year to compute (UTC). Defaults to current UTC year. */
  year?: number;
}): YearlyEvolutionResult {
  const { movements, currency } = input;
  const year = input.year ?? new Date().getUTCFullYear();

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
