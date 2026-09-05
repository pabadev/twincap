import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot } from './build-dashboard-snapshot';
import { Movement, type MovementContext, type MovementLinkKind, type MovementType } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Money } from '../../domain/money';
import type { Currency } from '../../domain/currency';
import type { SerializedCategory } from '../../domain/category';
import type { DashboardFilters } from '../../../components/dashboard/dashboard-filters';

const SEED_DATE = new Date('2020-01-01');
/** Reference instant = the real clock. `buildDashboardSnapshot` computes
 *  "current month"/"current year" from `new Date()` internally (it does not
 *  accept an injected `now`), so fixtures and expectations must be derived
 *  from the live clock instead of a hardcoded date, or the suite goes stale
 *  when the month/year rolls over. */
const NOW = new Date();
const utcMonthKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const nowYear = NOW.getUTCFullYear();
const nowMonth = NOW.getUTCMonth(); // 0-indexed

/** A calendar date in the current UTC year at the given 0-indexed month. */
function inYear(monthIndex: number, day = 10): Date {
  return new Date(Date.UTC(nowYear, monthIndex, day, 12));
}
/** A calendar date in the current UTC month. */
function inCurrentMonth(day = 10): Date {
  return new Date(Date.UTC(nowYear, nowMonth, day, 12));
}
/** A calendar date in the immediately preceding UTC month. */
function inLastMonth(day = 15): Date {
  return new Date(Date.UTC(nowYear, nowMonth - 1, day, 12));
}
/** A month (0-indexed) of the current year that is guaranteed not to be the
 *  current month, so a "current month" assertion can never be affected by the
 *  real rollover. Prefer March when available; else a month several away. */
function otherMonthIndex(): number {
  const candidate = [2, 3, 4, 5, 6, 7, 8, 9, 10].find((m) => m !== nowMonth) ?? 0;
  return candidate;
}
/** The 6-month UTC window ending at the current month, oldest first. */
function lastSixMonths(): string[] {
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(nowYear, nowMonth - i, 1));
    keys.push(utcMonthKey(d));
  }
  return keys;
}
/** The 12 UTC months of the current year, oldest first. */
function currentYearMonths(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) keys.push(utcMonthKey(new Date(Date.UTC(nowYear, i, 1))));
  return keys;
}

let seq = 0;

function category(type: MovementType, id?: string, name?: string): Category {
  return new Category({
    id: id ?? `cat-${type}`,
    workspaceId: 'u1',
    name: name ?? `Cat ${type}`,
    type,
    createdAt: SEED_DATE,
  });
}

function movement(input: {
  type: MovementType;
  amount: number;
  accountId?: string;
  categoryId?: string;
  currency?: Currency;
  date?: Date;
  linkKind?: MovementLinkKind;
  context?: MovementContext;
}): Movement {
  return new Movement({
    id: `m-${++seq}`,
    workspaceId: 'u1',
    accountId: input.accountId ?? 'acc-1',
    category: category(input.type, input.categoryId),
    type: input.type,
    amount: new Money(input.amount, input.currency ?? 'COP'),
    date: input.date ?? inCurrentMonth(),
    context: input.context ?? 'Personal',
    createdAt: SEED_DATE,
    link: input.linkKind
      ? { kind: input.linkKind, refId: `ref-${seq}`, opId: `op-${seq}` }
      : undefined,
  });
}

const accounts = [
  { id: 'acc-1', name: 'Cash', currency: 'COP', isFixed: true, balance: 2_000_000 },
  { id: 'acc-2', name: 'Ahorros', currency: 'USD', isFixed: false, balance: 1500 },
];

const categories: SerializedCategory[] = [
  { id: 'cat-income', workspaceId: 'u1', name: 'Salario', type: 'income', createdAt: SEED_DATE },
  { id: 'cat-salary-in', workspaceId: 'u1', name: 'Salario in', type: 'income', createdAt: SEED_DATE },
  { id: 'cat-freelance', workspaceId: 'u1', name: 'Freelance', type: 'income', createdAt: SEED_DATE },
  { id: 'cat-food', workspaceId: 'u1', name: 'Comida', type: 'expense', createdAt: SEED_DATE },
  { id: 'cat-rent', workspaceId: 'u1', name: 'Arriendo', type: 'expense', createdAt: SEED_DATE },
];

const resolveCategoryLabel = (categoryId: string): string => {
  const found = categories.find((c) => c.id === categoryId);
  return found?.name ?? 'Uncategorized';
};

const allFilters: DashboardFilters = {
  scope: 'all',
  accountId: 'all',
  categoryId: 'all',
};

function buildInput(
  movements: Movement[],
  filters: DashboardFilters = allFilters,
) {
  return {
    accounts,
    categories,
    movements,
    filters,
    locale: 'es' as const,
    primaryCurrency: 'COP',
    resolveCategoryLabel,
  };
}

describe('buildDashboardSnapshot', () => {
  it('empty movements: zeroed aggregates, empty rows and recent', () => {
    const snapshot = buildDashboardSnapshot(buildInput([]));
    expect(snapshot.monthlyIncome).toBe(0);
    expect(snapshot.monthlyExpenses).toBe(0);
    expect(snapshot.financingInflow).toBe(0);
    expect(snapshot.financingOutflow).toBe(0);
    expect(snapshot.totalIncome).toBe(0);
    expect(snapshot.totalExpenses).toBe(0);
    expect(snapshot.incomeRows).toEqual([]);
    expect(snapshot.expenseRows).toEqual([]);
    expect(snapshot.recentMovements).toEqual([]);
    expect(snapshot.accountBalances).toHaveLength(2);
    expect(snapshot.currency).toBe('COP');
  });

  it('current month: computes monthly income/expenses and rows with resolved labels', () => {
    const salary = movement({ type: 'income', amount: 2_000_000, categoryId: 'cat-salary-in' });
    const freelance = movement({ type: 'income', amount: 500_000, categoryId: 'cat-freelance' });
    const food = movement({ type: 'expense', amount: 300_000, categoryId: 'cat-food' });

    const snapshot = buildDashboardSnapshot(buildInput([salary, freelance, food]));

    expect(snapshot.monthlyIncome).toBe(2_500_000);
    expect(snapshot.monthlyExpenses).toBe(300_000);
    expect(snapshot.totalIncome).toBe(2_500_000);
    expect(snapshot.totalExpenses).toBe(300_000);

    // income rows sorted by amount desc, labels resolved to real category names
    expect(snapshot.incomeRows).toEqual([
      { label: 'Salario in', value: 2_000_000 },
      { label: 'Freelance', value: 500_000 },
    ]);
    expect(snapshot.expenseRows).toEqual([{ label: 'Comida', value: 300_000 }]);
  });

  it('fixed window (N2): summary tables and recent movements are scoped to the current civil month', () => {
    const thisMonth = movement({ type: 'income', amount: 1_000_000, categoryId: 'cat-income' });
    const lastMonth = movement({
      type: 'income',
      amount: 700_000,
      date: inLastMonth(),
      categoryId: 'cat-income',
    });

    const snapshot = buildDashboardSnapshot(buildInput([thisMonth, lastMonth]));

    // The last-month movement must NOT leak into the current-month cards,
    // even though it is inside the unfiltered set (it still feeds the charts).
    expect(snapshot.totalIncome).toBe(1_000_000);
    expect(snapshot.monthlyIncome).toBe(1_000_000);
    expect(snapshot.recentMovements.map((m) => m.id)).toEqual([thisMonth.id]);
  });

  it('scope filter: Personal excludes Business movements', () => {
    const personal = movement({ type: 'income', amount: 1_000_000, categoryId: 'cat-income', context: 'Personal' });
    const business = movement({ type: 'income', amount: 500_000, categoryId: 'cat-income', context: 'Business' });

    const snapshot = buildDashboardSnapshot(
      buildInput([personal, business], { ...allFilters, scope: 'Personal' }),
    );

    expect(snapshot.totalIncome).toBe(1_000_000);
    expect(snapshot.recentMovements.map((m) => m.id)).toEqual([personal.id]);
  });

  it('accountId filter: narrows account balances, movements and currency', () => {
    const cop = movement({ type: 'income', amount: 1_000_000, accountId: 'acc-1', categoryId: 'cat-income' });
    const usd = movement({
      type: 'expense',
      amount: 200,
      accountId: 'acc-2',
      currency: 'USD',
      categoryId: 'cat-food',
    });

    const snapshot = buildDashboardSnapshot(
      buildInput([cop, usd], { ...allFilters, accountId: 'acc-2' }),
    );

    expect(snapshot.accountBalances).toEqual([
      { id: 'acc-2', name: 'Ahorros', currency: 'USD', isFixed: false, balance: 1500 },
    ]);
    expect(snapshot.currency).toBe('USD');
    // Only USD movements aggregate
    expect(snapshot.monthlyExpenses).toBe(200);
    expect(snapshot.monthlyIncome).toBe(0);
  });

  it('categoryId filter: filters movements to that category', () => {
    const salary = movement({ type: 'income', amount: 2_000_000, categoryId: 'cat-salary-in' });
    const freelance = movement({ type: 'income', amount: 500_000, categoryId: 'cat-freelance' });

    const snapshot = buildDashboardSnapshot(
      buildInput([salary, freelance], { ...allFilters, categoryId: 'cat-freelance' }),
    );

    expect(snapshot.totalIncome).toBe(500_000);
    expect(snapshot.incomeRows).toEqual([{ label: 'Freelance', value: 500_000 }]);
  });

  it('multi-currency: currencyBreakdown aggregates per currency with economic filtering', () => {
    const copSalary = movement({ type: 'income', amount: 2_000_000, accountId: 'acc-1', categoryId: 'cat-income' });
    const usdExpense = movement({
      type: 'expense',
      amount: 400,
      accountId: 'acc-2',
      currency: 'USD',
      categoryId: 'cat-food',
    });

    const snapshot = buildDashboardSnapshot(buildInput([copSalary, usdExpense]));

    // COP first, then USD; balances from accounts + economic flows
    expect(snapshot.currencyBreakdown).toEqual([
      { currency: 'COP', balance: 2_000_000, income: 2_000_000, expenses: 0 },
      { currency: 'USD', balance: 1500, income: 0, expenses: 400 },
    ]);
  });

  it('monthlyData: 6-month window padded, oldest first, current month last', () => {
    const july = movement({ type: 'income', amount: 100_000, date: inLastMonth(), categoryId: 'cat-income' });

    const snapshot = buildDashboardSnapshot(buildInput([july]));

    expect(snapshot.monthlyData.map((b) => b.month)).toEqual(lastSixMonths());
    // The last-month bucket sits at index 4 in a 6-month window ending at the current month.
    expect(snapshot.monthlyData[4]).toEqual({ month: utcMonthKey(inLastMonth()), income: 100_000, expenses: 0 });
  });

  it('yearlyData: 12-month window for the current year', () => {
    const jan = movement({ type: 'income', amount: 50_000, date: inYear(0), categoryId: 'cat-income' });
    const snapshot = buildDashboardSnapshot(buildInput([jan]));

    expect(snapshot.yearlyData).toHaveLength(12);
    expect(snapshot.yearlyData[0]).toEqual({ month: utcMonthKey(inYear(0)), income: 50_000, expenses: 0 });
    expect(snapshot.yearlyData.map((b) => b.month)).toEqual(currentYearMonths());
  });

  it('recentMovements: top 5 with resolved categoryName and ISO date', () => {
    const movements = Array.from({ length: 7 }, (_, i) =>
      movement({
        type: i % 2 === 0 ? 'income' : 'expense',
        amount: (i + 1) * 100_000,
        categoryId: i % 2 === 0 ? 'cat-income' : 'cat-food',
        date: inCurrentMonth(i + 1),
      }),
    );

    const snapshot = buildDashboardSnapshot(buildInput(movements));

    expect(snapshot.recentMovements).toHaveLength(5);
    expect(snapshot.recentMovements[0].id).toBe(movements[0].id);
    expect(snapshot.recentMovements[0].categoryName).toBe('Salario');
    expect(snapshot.recentMovements[0].date).toBe(inCurrentMonth(1).toISOString());
    expect(typeof snapshot.recentMovements[0].date).toBe('string');
  });

  it('synthetic category labels resolve to localized/system label', () => {
    const sale = movement({
      type: 'income',
      amount: 300_000,
      categoryId: '000000000000000000000004', // SALE_CATEGORY_ID
      linkKind: 'salePayment',
      context: 'Business',
    });

    const syntheticResolver = (categoryId: string): string => {
      if (categoryId === '000000000000000000000004') return 'Venta';
      return categoryId;
    };

    const snapshot = buildDashboardSnapshot({
      accounts,
      categories,
      movements: [sale],
      filters: allFilters,
      locale: 'es' as const,
      primaryCurrency: 'COP',
      resolveCategoryLabel: syntheticResolver,
    });

    expect(snapshot.incomeRows).toEqual([{ label: 'Venta', value: 300_000 }]);
    expect(snapshot.recentMovements[0].categoryName).toBe('Venta');
  });

  it('synthetic category id with no resolver falls back to uncategorized label', () => {
    const sale = movement({
      type: 'income',
      amount: 300_000,
      categoryId: 'synthetic-unknown',
      linkKind: 'salePayment',
      context: 'Business',
    });

    // A resolver that returns the raw id (as the uncategorized fallback path does)
    const snapshot = buildDashboardSnapshot(
      buildInput([sale], { ...allFilters, categoryId: 'all' }),
    );
    expect(snapshot.incomeRows).toEqual([{ label: 'Uncategorized', value: 300_000 }]);
  });
});

describe('buildDashboardSnapshot — A6/N1 contextSummary', () => {
  it('scope all: splits the current-month result between Personal and Business', () => {
    const personal = movement({ type: 'income', amount: 1_000_000, context: 'Personal' });
    const businessIncome = movement({ type: 'income', amount: 500_000, context: 'Business' });
    const businessExpense = movement({ type: 'expense', amount: 200_000, context: 'Business' });

    const snapshot = buildDashboardSnapshot(
      buildInput([personal, businessIncome, businessExpense]),
    );

    expect(snapshot.contextSummary).toEqual({
      personal: [{ currency: 'COP', monthlyIncome: 1_000_000, monthlyExpenses: 0 }],
      business: [{ currency: 'COP', monthlyIncome: 500_000, monthlyExpenses: 200_000 }],
    });
    // Total cards unchanged
    expect(snapshot.monthlyIncome).toBe(1_500_000);
    expect(snapshot.monthlyExpenses).toBe(200_000);
  });

  it('scope all: splits by context AND currency (N1)', () => {
    const personalCop = movement({ type: 'income', amount: 1_000_000, context: 'Personal' });
    const personalUsd = movement({ type: 'income', amount: 200, currency: 'USD', context: 'Personal' });
    const businessUsd = movement({ type: 'expense', amount: 80, currency: 'USD', context: 'Business' });

    const snapshot = buildDashboardSnapshot(
      buildInput([personalCop, personalUsd, businessUsd]),
    );

    // Each context carries one entry PER currency with economic data —
    // the USD movements are no longer dropped by the COP scope.
    expect(snapshot.contextSummary).toEqual({
      personal: [
        { currency: 'COP', monthlyIncome: 1_000_000, monthlyExpenses: 0 },
        { currency: 'USD', monthlyIncome: 200, monthlyExpenses: 0 },
      ],
      business: [{ currency: 'USD', monthlyIncome: 0, monthlyExpenses: 80 }],
    });
    // Total cards keep their own aggregation currency (primary COP).
    expect(snapshot.monthlyIncome).toBe(1_000_000);
    expect(snapshot.monthlyExpenses).toBe(0);
  });

  it('scope Personal: contextSummary is not populated', () => {
    const personal = movement({ type: 'income', amount: 1_000_000, context: 'Personal' });
    const business = movement({ type: 'expense', amount: 200_000, context: 'Business' });

    const snapshot = buildDashboardSnapshot(
      buildInput([personal, business], { ...allFilters, scope: 'Personal' }),
    );

    expect(snapshot.contextSummary).toBeUndefined();
  });

  it('fixed window (N2): contextSummary and card totals reflect only the current month, charts carry the full series', () => {
    const other = otherMonthIndex();
    const otherMonthBusiness = movement({ type: 'income', amount: 500_000, date: inYear(other), context: 'Business', categoryId: 'cat-income' });
    const curBusiness = movement({ type: 'income', amount: 300_000, context: 'Business', categoryId: 'cat-income' });

    const snapshot = buildDashboardSnapshot(
      buildInput([otherMonthBusiness, curBusiness]),
    );

    // The other-month movement is inside the unfiltered set but outside the
    // current month: excluded from the cards AND from contextSummary…
    expect(snapshot.contextSummary?.business).toEqual([
      { currency: 'COP', monthlyIncome: 300_000, monthlyExpenses: 0 },
    ]);
    expect(snapshot.totalIncome).toBe(300_000);
    // …but still present with real data in the chart series (the old
    // "11 empty buckets" asymmetry is gone).
    const otherKey = utcMonthKey(inYear(other));
    expect(snapshot.yearlyData[other]).toEqual({ month: otherKey, income: 500_000, expenses: 0 });
  });

  it('omits a context section whose movements carry no economic result', () => {
    const transfer = movement({ type: 'income', amount: 5_000_000, linkKind: 'transfer' });
    const businessInc = movement({ type: 'income', amount: 100_000, context: 'Business' });

    const snapshot = buildDashboardSnapshot(buildInput([transfer, businessInc]));

    expect(snapshot.contextSummary?.personal).toBeUndefined();
    expect(snapshot.contextSummary?.business).toEqual([
      { currency: 'COP', monthlyIncome: 100_000, monthlyExpenses: 0 },
    ]);
  });
});

describe('buildDashboardSnapshot — A11 chartDataByCurrency', () => {
  it('multi-currency: ships per-currency chart series and keeps the single-currency fields', () => {
    const copIncome = movement({ type: 'income', amount: 2_000_000, accountId: 'acc-1', categoryId: 'cat-income' });
    const usdExpense = movement({ type: 'expense', amount: 400, accountId: 'acc-2', currency: 'USD', categoryId: 'cat-food' });

    const snapshot = buildDashboardSnapshot(buildInput([copIncome, usdExpense]));

    expect(snapshot.chartCurrencies).toEqual(['COP', 'USD']);
    expect(snapshot.chartDataByCurrency).toBeDefined();
    // Single-currency fields keep today's shape (zero-change)
    expect(snapshot.monthlyData).toHaveLength(6);
    expect(snapshot.yearlyData).toHaveLength(12);

    const currentKey = utcMonthKey(inCurrentMonth());
    const usd = snapshot.chartDataByCurrency!['USD'];
    expect(usd.monthly).toHaveLength(6);
    expect(usd.monthly[5]).toEqual({ month: currentKey, income: 0, expenses: 400 });
    expect(usd.yearly[nowMonth]).toEqual({ month: currentKey, income: 0, expenses: 400 });

    const cop = snapshot.chartDataByCurrency!['COP'];
    expect(cop.monthly[5]).toEqual({ month: currentKey, income: 2_000_000, expenses: 0 });
    // The COP per-currency series IS what monthlyData reports today
    expect(snapshot.monthlyData).toEqual(cop.monthly);
  });

  it('mono-currency: chartCurrencies/chartDataByCurrency stay undefined (zero-change)', () => {
    const copIncome = movement({ type: 'income', amount: 2_000_000 });

    const snapshot = buildDashboardSnapshot(buildInput([copIncome]));

    expect(snapshot.chartCurrencies).toBeUndefined();
    expect(snapshot.chartDataByCurrency).toBeUndefined();
    expect(snapshot.monthlyData).toHaveLength(6);
    expect(snapshot.yearlyData).toHaveLength(12);
  });
});

describe('buildDashboardSnapshot — N2 fixed windows (charts), Fase 5', () => {
  it('movements in the previous AND current month both appear with real data in the 6/12 series', () => {
    const lastMonthIncome = movement({ type: 'income', amount: 700_000, date: inLastMonth(), categoryId: 'cat-income' });
    const thisMonthExpense = movement({ type: 'expense', amount: 200_000, categoryId: 'cat-food' });

    const snapshot = buildDashboardSnapshot(buildInput([lastMonthIncome, thisMonthExpense]));

    const lastKey = utcMonthKey(inLastMonth());
    const curKey = utcMonthKey(inCurrentMonth());

    // 6-month series: BOTH months carry their real values (previously the
    // current_month period filter zeroed the past buckets).
    const monthlyIdx = new Map(snapshot.monthlyData.map((b, i) => [b.month, i]));
    expect(snapshot.monthlyData[monthlyIdx.get(lastKey)!]).toEqual({ month: lastKey, income: 700_000, expenses: 0 });
    expect(snapshot.monthlyData[monthlyIdx.get(curKey)!]).toEqual({ month: curKey, income: 0, expenses: 200_000 });

    // 12-month series: same real data for the current civil year. When the
    // current month is January the previous month belongs to the previous
    // year, which the current-year series must NOT contain.
    const yearlyIdx = new Map(snapshot.yearlyData.map((b, i) => [b.month, i]));
    expect(snapshot.yearlyData[yearlyIdx.get(curKey)!]).toEqual({ month: curKey, income: 0, expenses: 200_000 });
    if (nowMonth >= 1) {
      expect(snapshot.yearlyData[yearlyIdx.get(lastKey)!]).toEqual({ month: lastKey, income: 700_000, expenses: 0 });
    } else {
      expect(yearlyIdx.has(lastKey)).toBe(false);
    }

    // Cards + recent movements: current civil month ONLY.
    expect(snapshot.monthlyIncome).toBe(0);
    expect(snapshot.monthlyExpenses).toBe(200_000);
    expect(snapshot.totalIncome).toBe(0);
    expect(snapshot.totalExpenses).toBe(200_000);
    expect(snapshot.recentMovements.map((m) => m.id)).toEqual([thisMonthExpense.id]);
  });

  it('every month of the 6-month window keeps its real data — no zeroed buckets', () => {
    const movements = lastSixMonths().map((key, i) => {
      const [y, m] = key.split('-').map(Number);
      return movement({
        type: i % 2 === 0 ? 'income' : 'expense',
        amount: (i + 1) * 100_000,
        date: new Date(Date.UTC(y, m - 1, 15, 12)),
        categoryId: i % 2 === 0 ? 'cat-income' : 'cat-food',
      });
    });

    const snapshot = buildDashboardSnapshot(buildInput(movements));

    expect(snapshot.monthlyData).toEqual(
      lastSixMonths().map((key, i) => ({
        month: key,
        income: i % 2 === 0 ? (i + 1) * 100_000 : 0,
        expenses: i % 2 === 0 ? 0 : (i + 1) * 100_000,
      })),
    );
    // Cards still aggregate only the current month's slice (the last bucket,
    // i=5 → an expense of 600_000).
    expect(snapshot.monthlyIncome).toBe(0);
    expect(snapshot.monthlyExpenses).toBe(600_000);
  });

  it('yearly series: non-current months of the current year carry real data (11 months no longer empty)', () => {
    const other = otherMonthIndex();
    const otherMonth = movement({ type: 'income', amount: 250_000, date: inYear(other), categoryId: 'cat-income' });
    const curMonth = movement({ type: 'expense', amount: 80_000, categoryId: 'cat-food' });

    const snapshot = buildDashboardSnapshot(buildInput([otherMonth, curMonth]));

    expect(snapshot.yearlyData).toHaveLength(12);
    const otherKey = utcMonthKey(inYear(other));
    expect(snapshot.yearlyData[other]).toEqual({ month: otherKey, income: 250_000, expenses: 0 });
    expect(snapshot.yearlyData[nowMonth]).toEqual({ month: utcMonthKey(inCurrentMonth()), income: 0, expenses: 80_000 });

    // The non-current month feeds the chart only — never the cards.
    expect(snapshot.totalIncome).toBe(0);
    expect(snapshot.totalExpenses).toBe(80_000);
    expect(snapshot.recentMovements.map((m) => m.id)).toEqual([curMonth.id]);
  });
});
