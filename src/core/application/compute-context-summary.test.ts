import { describe, expect, it } from 'vitest';
import { computeContextSummary } from './compute-context-summary';
import { Movement, type MovementContext, type MovementLinkKind, type MovementType } from '../domain/movement';
import { Category } from '../domain/category';
import { Money } from '../domain/money';
import type { Currency } from '../domain/currency';

const SEED_DATE = new Date('2020-01-01');
/** Fixed reference instant — the helper accepts an injectable `now`. */
const NOW = new Date('2026-08-20T12:00:00Z');

function category(type: MovementType, id?: string): Category {
  return new Category({
    id: id ?? `cat-${type}`,
    workspaceId: 'u1',
    name: `Cat ${type}`,
    type,
    createdAt: SEED_DATE,
  });
}

function movement(input: {
  type: MovementType;
  amount: number;
  date?: Date;
  context?: MovementContext;
  currency?: Currency;
  linkKind?: MovementLinkKind;
}): Movement {
  const { type, amount, date, currency, linkKind, context } = input;
  return new Movement({
    id: `m-${Math.random().toString(36).slice(2)}`,
    workspaceId: 'u1',
    accountId: 'acc-1',
    category: category(type),
    type,
    amount: new Money(amount, currency ?? 'COP'),
    date: date ?? new Date('2026-08-10T12:00:00Z'),
    // Passed through as-is: omitting it yields a legacy movement (undefined
    // context), which the helper must group as Personal.
    context,
    createdAt: SEED_DATE,
    link: linkKind
      ? { kind: linkKind, refId: 'ref-1', opId: 'op-1' }
      : undefined,
  });
}

const aug = (day: number) => new Date(Date.UTC(2026, 7, day, 12));

describe('computeContextSummary', () => {
  it('splits the current-month result between Personal and Business', () => {
    const personal = movement({ type: 'income', amount: 1_000_000 });
    const businessIncome = movement({ type: 'income', amount: 500_000, context: 'Business' });
    const businessExpense = movement({ type: 'expense', amount: 200_000, context: 'Business' });

    const result = computeContextSummary({
      movements: [personal, businessIncome, businessExpense],
      now: NOW,
    });

    expect(result).toEqual({
      personal: [{ currency: 'COP', monthlyIncome: 1_000_000, monthlyExpenses: 0 }],
      business: [{ currency: 'COP', monthlyIncome: 500_000, monthlyExpenses: 200_000 }],
    });
  });

  it('groups legacy movements without context as Personal', () => {
    const legacyIncome = movement({ type: 'income', amount: 800_000, context: undefined });
    const legacyExpense = movement({ type: 'expense', amount: 300_000, context: undefined });

    const result = computeContextSummary({
      movements: [legacyIncome, legacyExpense],
      now: NOW,
    });

    expect(result).toEqual({
      personal: [{ currency: 'COP', monthlyIncome: 800_000, monthlyExpenses: 300_000 }],
    });
    expect(result.business).toBeUndefined();
  });

  it('creditGrantedAbono: Business counts, standalone Personal capital recovery does not', () => {
    const businessAbono = movement({
      type: 'income',
      amount: 500_000,
      context: 'Business',
      linkKind: 'creditGrantedAbono',
    });
    const personalAbono = movement({
      type: 'income',
      amount: 400_000,
      context: 'Personal',
      linkKind: 'creditGrantedAbono',
    });
    const personalSalary = movement({ type: 'income', amount: 900_000 });

    const result = computeContextSummary({
      movements: [businessAbono, personalAbono, personalSalary],
      now: NOW,
    });

    // Business abono IS commercial income; the standalone Personal abono is
    // capital recovery and must NOT inflate the Personal income.
    expect(result.business).toEqual([{ currency: 'COP', monthlyIncome: 500_000, monthlyExpenses: 0 }]);
    expect(result.personal).toEqual([{ currency: 'COP', monthlyIncome: 900_000, monthlyExpenses: 0 }]);
  });

  it('aggregates per currency: non-primary currencies appear as their own entries (N1)', () => {
    const cop = movement({ type: 'income', amount: 600_000 });
    const usdIncome = movement({ type: 'income', amount: 100, currency: 'USD' });
    const usdExpense = movement({ type: 'expense', amount: 40, currency: 'USD' });

    const result = computeContextSummary({
      movements: [cop, usdIncome, usdExpense],
      now: NOW,
    });

    // The USD movement is no longer dropped — it gets its own currency entry
    // alongside COP (COP first, then alphabetical).
    expect(result.personal).toEqual([
      { currency: 'COP', monthlyIncome: 600_000, monthlyExpenses: 0 },
      { currency: 'USD', monthlyIncome: 100, monthlyExpenses: 40 },
    ]);
  });

  it('counts only the current calendar month', () => {
    const lastMonth = movement({ type: 'income', amount: 900_000, date: new Date('2026-07-15T12:00:00Z') });
    const thisMonth = movement({ type: 'income', amount: 300_000, date: aug(10) });

    const result = computeContextSummary({
      movements: [lastMonth, thisMonth],
      now: NOW,
    });

    expect(result.personal).toEqual([{ currency: 'COP', monthlyIncome: 300_000, monthlyExpenses: 0 }]);
  });

  it('honors the civil date shift (A2): 2026-09-01T02:00Z with offset 300 is still August', () => {
    const augMovement = movement({ type: 'income', amount: 400_000, date: aug(31) });
    const sepMovement = movement({ type: 'income', amount: 100_000, date: new Date('2026-09-01T00:00:00Z') });

    const result = computeContextSummary({
      movements: [augMovement, sepMovement],
      now: new Date('2026-09-01T02:00:00Z'),
      tzOffsetMinutes: 300,
    });

    expect(result.personal).toEqual([{ currency: 'COP', monthlyIncome: 400_000, monthlyExpenses: 0 }]);
  });

  it('omits a context section when it has movements but no economic result', () => {
    const transfer = movement({ type: 'income', amount: 500_000, linkKind: 'transfer' });
    const businessExpense = movement({ type: 'expense', amount: 120_000, context: 'Business' });

    const result = computeContextSummary({
      movements: [transfer, businessExpense],
      now: NOW,
    });

    // Personal has a movement (the transfer) but nothing economic → omitted.
    expect(result.personal).toBeUndefined();
    expect(result.business).toEqual([{ currency: 'COP', monthlyIncome: 0, monthlyExpenses: 120_000 }]);
  });

  it('returns an empty summary with no movements', () => {
    const result = computeContextSummary({ movements: [], now: NOW });
    expect(result).toEqual({});
  });
});