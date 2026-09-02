import { describe, expect, it } from 'vitest';
import { computeYearlyEvolution } from './compute-yearly-evolution';
import { Movement } from '../domain/movement';
import { Category } from '../domain/category';
import { Money } from '../domain/money';
import type { Currency } from '../domain/currency';
import type { MovementLinkKind, MovementType } from '../domain/movement';

const SEED_DATE = new Date('2026-01-01');

function category(type: MovementType): Category {
  return new Category({
    id: `cat-${type}`,
    userId: 'u1',
    name: `Cat ${type}`,
    type,
    createdAt: SEED_DATE,
  });
}

let seq = 0;

function movement(input: {
  type: MovementType;
  amount: number;
  currency?: string;
  date: Date;
  linkKind?: MovementLinkKind;
}): Movement {
  return new Movement({
    id: `m-${++seq}`,
    userId: 'u1',
    accountId: 'acc-1',
    category: category(input.type),
    type: input.type,
    amount: new Money(input.amount, (input.currency ?? 'COP') as Currency),
    date: input.date,
    createdAt: SEED_DATE,
    link: input.linkKind
      ? { kind: input.linkKind, refId: `ref-${seq}`, opId: `op-${seq}` }
      : undefined,
  });
}

describe('computeYearlyEvolution', () => {
  it('returns 12 months for the year, zeros where no data', () => {
    const result = computeYearlyEvolution({
      movements: [],
      currency: 'COP',
      year: 2026,
    });

    expect(result.months).toHaveLength(12);
    expect(result.months[0].month).toBe('2026-01');
    expect(result.months[11].month).toBe('2026-12');
    result.months.forEach((m) => {
      expect(m.income).toBe(0);
      expect(m.expenses).toBe(0);
    });
  });

  it('buckets income and expenses by month', () => {
    const movements = [
      movement({ type: 'income', amount: 1_000_000, date: new Date('2026-03-15') }),
      movement({ type: 'expense', amount: 200_000, date: new Date('2026-03-20') }),
      movement({ type: 'income', amount: 3_000_000, date: new Date('2026-05-10') }),
      movement({ type: 'expense', amount: 500_000, date: new Date('2026-05-25') }),
    ];

    const result = computeYearlyEvolution({
      movements,
      currency: 'COP',
      year: 2026,
    });

    expect(result.months[2]).toEqual({ month: '2026-03', income: 1_000_000, expenses: 200_000 });
    expect(result.months[4]).toEqual({ month: '2026-05', income: 3_000_000, expenses: 500_000 });
    // Other months should be zeros
    expect(result.months[0].income).toBe(0);
    expect(result.months[11].expenses).toBe(0);
  });

  it('excludes transfers (both legs)', () => {
    const movements = [
      movement({ type: 'income', amount: 1_000_000, date: new Date('2026-06-10') }),
      movement({ type: 'expense', amount: 500_000, date: new Date('2026-06-15'), linkKind: 'transfer' }),
      movement({ type: 'income', amount: 500_000, date: new Date('2026-06-15'), linkKind: 'transfer' }),
    ];

    const result = computeYearlyEvolution({
      movements,
      currency: 'COP',
      year: 2026,
    });

    expect(result.months[5]).toEqual({ month: '2026-06', income: 1_000_000, expenses: 0 });
  });

  it('excludes opening balances', () => {
    const movements = [
      movement({ type: 'income', amount: 10_000_000, date: new Date('2026-01-01'), linkKind: 'opening' }),
      movement({ type: 'income', amount: 500_000, date: new Date('2026-01-10') }),
    ];

    const result = computeYearlyEvolution({
      movements,
      currency: 'COP',
      year: 2026,
    });

    expect(result.months[0]).toEqual({ month: '2026-01', income: 500_000, expenses: 0 });
  });

  it('currency filtering: ignores movements in other currencies', () => {
    const movements = [
      movement({ type: 'income', amount: 1_000_000, currency: 'COP', date: new Date('2026-04-10') }),
      movement({ type: 'income', amount: 500_00, currency: 'USD', date: new Date('2026-04-15') }),
    ];

    const result = computeYearlyEvolution({
      movements,
      currency: 'COP',
      year: 2026,
    });

    expect(result.months[3]).toEqual({ month: '2026-04', income: 1_000_000, expenses: 0 });
  });

  it('ignores movements from other years', () => {
    const movements = [
      movement({ type: 'income', amount: 1_000_000, date: new Date('2025-12-15') }),
      movement({ type: 'expense', amount: 200_000, date: new Date('2027-01-10') }),
      movement({ type: 'income', amount: 500_000, date: new Date('2026-06-10') }),
    ];

    const result = computeYearlyEvolution({
      movements,
      currency: 'COP',
      year: 2026,
    });

    // Only June 2026 should have data
    expect(result.months[5]).toEqual({ month: '2026-06', income: 500_000, expenses: 0 });
    // All others zero
    expect(result.months[0].income).toBe(0);
    expect(result.months[11].income).toBe(0);
  });

  it('defaults to current UTC year when year not specified', () => {
    const movements = [
      movement({ type: 'income', amount: 999, date: new Date('2026-07-01') }),
    ];

    const result = computeYearlyEvolution({
      movements,
      currency: 'COP',
    });

    expect(result.months[6].month).toBe('2026-07');
    expect(result.months[6].income).toBe(999);
  });

  it('excludes financing principals but keeps credit abonos', () => {
    const movements = [
      movement({ type: 'income', amount: 800_000, date: new Date('2026-06-10'), linkKind: 'creditReceivedPrincipal' }),
      movement({ type: 'expense', amount: 300_000, date: new Date('2026-06-15'), linkKind: 'creditGrantedPrincipal' }),
      movement({ type: 'expense', amount: 120_000, date: new Date('2026-06-20'), linkKind: 'creditReceivedAbono' }),
      movement({ type: 'income', amount: 150_000, date: new Date('2026-06-25'), linkKind: 'creditGrantedAbonoInterest' }),
    ];

    const result = computeYearlyEvolution({
      movements,
      currency: 'COP',
      year: 2026,
    });

    expect(result.months[5]).toEqual({ month: '2026-06', income: 150_000, expenses: 120_000 });
  });
});
