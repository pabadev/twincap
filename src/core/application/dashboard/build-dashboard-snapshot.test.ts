import { describe, expect, it } from 'vitest';
import { buildDashboardSnapshot } from './build-dashboard-snapshot';
import { Movement, type MovementContext, type MovementLinkKind, type MovementType } from '../../domain/movement';
import { Category } from '../../domain/category';
import { Money } from '../../domain/money';
import type { Currency } from '../../domain/currency';
import type { SerializedCategory } from '../../domain/category';
import type { DashboardFilters } from '../../../components/dashboard/dashboard-filters';

const SEED_DATE = new Date('2026-01-01');
/** Fixed "today" inside the test window: August 2026 (current month). */
const NOW = new Date('2026-08-20T12:00:00Z');

let seq = 0;

function category(type: MovementType, id?: string, name?: string): Category {
  return new Category({
    id: id ?? `cat-${type}`,
    userId: 'u1',
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
    userId: 'u1',
    accountId: input.accountId ?? 'acc-1',
    category: category(input.type, input.categoryId),
    type: input.type,
    amount: new Money(input.amount, input.currency ?? 'COP'),
    date: input.date ?? new Date('2026-08-10'),
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
  { id: 'cat-income', userId: 'u1', name: 'Salario', type: 'income', createdAt: SEED_DATE },
  { id: 'cat-salary-in', userId: 'u1', name: 'Salario in', type: 'income', createdAt: SEED_DATE },
  { id: 'cat-freelance', userId: 'u1', name: 'Freelance', type: 'income', createdAt: SEED_DATE },
  { id: 'cat-food', userId: 'u1', name: 'Comida', type: 'expense', createdAt: SEED_DATE },
  { id: 'cat-rent', userId: 'u1', name: 'Arriendo', type: 'expense', createdAt: SEED_DATE },
];

const resolveCategoryLabel = (categoryId: string): string => {
  const found = categories.find((c) => c.id === categoryId);
  return found?.name ?? 'Uncategorized';
};

const allFilters: DashboardFilters = {
  scope: 'all',
  accountId: 'all',
  categoryId: 'all',
  period: 'current_month',
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

  it('period filter this_year includes current-year movements only', () => {
    const currentYear = movement({
      type: 'income',
      amount: 1_000_000,
      date: new Date('2026-03-10'),
      categoryId: 'cat-income',
    });
    const lastYear = movement({
      type: 'income',
      amount: 900_000,
      date: new Date('2025-12-25'),
      categoryId: 'cat-income',
    });

    const snapshot = buildDashboardSnapshot(
      buildInput([currentYear, lastYear], {
        ...allFilters,
        period: 'this_year',
      }),
    );

    expect(snapshot.totalIncome).toBe(1_000_000);
    expect(snapshot.monthlyIncome).toBe(0); // not in the current month
    expect(snapshot.recentMovements.map((m) => m.id)).toEqual([currentYear.id]);
  });

  it('period filter current_month only includes the current UTC month', () => {
    const thisMonth = movement({ type: 'income', amount: 1_000_000, categoryId: 'cat-income' });
    const lastMonth = movement({
      type: 'income',
      amount: 700_000,
      date: new Date('2026-07-15'),
      categoryId: 'cat-income',
    });

    const snapshot = buildDashboardSnapshot(
      buildInput([thisMonth, lastMonth], {
        ...allFilters,
        period: 'current_month',
      }),
    );

    expect(snapshot.totalIncome).toBe(1_000_000);
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
    const july = movement({ type: 'income', amount: 100_000, date: new Date('2026-07-05'), categoryId: 'cat-income' });
    const snapshot = buildDashboardSnapshot(
      buildInput([july], { ...allFilters, period: 'this_year' }),
    );

    expect(snapshot.monthlyData.map((b) => b.month)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
    expect(snapshot.monthlyData[4]).toEqual({ month: '2026-07', income: 100_000, expenses: 0 });
  });

  it('yearlyData: 12-month window for the current year', () => {
    const jan = movement({ type: 'income', amount: 50_000, date: new Date('2026-01-10'), categoryId: 'cat-income' });
    const snapshot = buildDashboardSnapshot(
      buildInput([jan], { ...allFilters, period: 'this_year' }),
    );

    expect(snapshot.yearlyData).toHaveLength(12);
    expect(snapshot.yearlyData[0]).toEqual({ month: '2026-01', income: 50_000, expenses: 0 });
    expect(snapshot.yearlyData.map((b) => b.month)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ]);
  });

  it('recentMovements: top 5 with resolved categoryName and ISO date', () => {
    const movements = Array.from({ length: 7 }, (_, i) =>
      movement({
        type: i % 2 === 0 ? 'income' : 'expense',
        amount: (i + 1) * 100_000,
        categoryId: i % 2 === 0 ? 'cat-income' : 'cat-food',
        date: new Date(2026, 7, i + 1),
      }),
    );

    const snapshot = buildDashboardSnapshot(buildInput(movements));

    expect(snapshot.recentMovements).toHaveLength(5);
    expect(snapshot.recentMovements[0].id).toBe(movements[0].id);
    expect(snapshot.recentMovements[0].categoryName).toBe('Salario');
    expect(snapshot.recentMovements[0].date).toBe(new Date(2026, 7, 1).toISOString());
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
