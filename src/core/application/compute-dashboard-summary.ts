import type { Movement, MovementLinkKind } from "../domain/movement";

/**
 * Link kinds that do NOT represent economic result (decision D2):
 * - `transfer`: moving money between own accounts changes WHERE money is,
 *   not the financial outcome (both legs excluded).
 * - `opening`: seeding an account with its starting balance is not income.
 */
const NON_ECONOMIC_LINK_KINDS: ReadonlySet<MovementLinkKind> = new Set([
  "transfer",
  "opening",
] as const);

/** UTC year-month key of a date — business dates are midnight-UTC civil dates (D1). */
function utcMonthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function countsTowardEconomicResult(movement: Movement): boolean {
  return !(movement.link && NON_ECONOMIC_LINK_KINDS.has(movement.link.kind));
}

export interface MonthBucket {
  /** UTC year-month key ("YYYY-MM") of the bucketed business dates. */
  month: string;
  income: number;
  expenses: number;
}

export interface DashboardMonthlySummary {
  /** Economic income of the current calendar month (excludes transfers/opening). */
  monthlyIncome: number;
  /** Economic expenses of the current calendar month (excludes transfers/opening). */
  monthlyExpenses: number;
  /** Last 6 calendar months ending with the current one, oldest first. */
  months: MonthBucket[];
}

/**
 * Aggregate dashboard economic-result numbers for ONE currency scope.
 *
 * Pure function over already-loaded movements. Movements whose link kind
 * marks them as internal flows (transfers, opening balance) never reach the
 * aggregates; every other movement keeps its existing cash-basis treatment
 * (credit principals, sale payments, payables — decision D2).
 *
 * Bucketing groups by the UTC year-month of each stored business date,
 * matching the civil-date storage convention (decision D1).
 */
export function computeDashboardSummary(input: {
  movements: Movement[];
  /** Currency scope — amounts in other currencies are ignored. */
  currency: string;
  /** Reference instant for the "current month"; defaults to the real clock. */
  now?: Date;
}): DashboardMonthlySummary {
  const { movements, currency } = input;
  const now = input.now ?? new Date();
  const currentKey = utcMonthKey(now);

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  const monthlyMap = new Map<string, { income: number; expenses: number }>();

  for (const m of movements) {
    if (!countsTowardEconomicResult(m)) continue;
    if (m.amount.currency !== currency) continue;

    const key = utcMonthKey(m.date);

    if (key === currentKey) {
      if (m.type === 'income') monthlyIncome += m.amount.amount;
      else monthlyExpenses += m.amount.amount;
    }

    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    if (m.type === 'income') bucket.income += m.amount.amount;
    else bucket.expenses += m.amount.amount;
    monthlyMap.set(key, bucket);
  }

  const months: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = utcMonthKey(d);
    const bucket = monthlyMap.get(key) ?? { income: 0, expenses: 0 };
    months.push({ month: key, ...bucket });
  }

  return { monthlyIncome, monthlyExpenses, months };
}
