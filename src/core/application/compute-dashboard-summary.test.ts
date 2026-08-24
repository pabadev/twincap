import { describe, expect, it } from "vitest";
import { computeDashboardSummary } from "./compute-dashboard-summary";
import { Movement } from "../domain/movement";
import type { MovementLinkKind, MovementType } from "../domain/movement";
import { Category } from "../domain/category";
import { Money } from "../domain/money";
import type { Currency } from "../domain/currency";

const SEED_DATE = new Date("2026-01-01");
/** Fixed "today" inside the test window: August 2026 (current month). */
const NOW = new Date("2026-08-20T12:00:00Z");

function category(type: MovementType): Category {
  return new Category({
    id: `cat-${type}`,
    userId: "u1",
    name: `Cat ${type}`,
    type,
    createdAt: SEED_DATE,
  });
}

let seq = 0;

function movement(input: {
  type: MovementType;
  amount: number;
  currency?: Currency;
  date?: Date;
  linkKind?: MovementLinkKind;
}): Movement {
  return new Movement({
    id: `m-${++seq}`,
    userId: "u1",
    accountId: "acc-1",
    category: category(input.type),
    type: input.type,
    amount: new Money(input.amount, input.currency ?? "COP"),
    date: input.date ?? new Date("2026-08-10"),
    context: "Personal",
    createdAt: SEED_DATE,
    link: input.linkKind
      ? { kind: input.linkKind, refId: `ref-${seq}`, opId: `op-${seq}` }
      : undefined,
  });
}

describe("computeDashboardSummary", () => {
  it("baseline: salary only counts as income, no expenses", () => {
    const salary = movement({ type: "income", amount: 2_000_000 });

    const summary = computeDashboardSummary({
      movements: [salary],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyIncome).toBe(2_000_000);
    expect(summary.monthlyExpenses).toBe(0);
    expect(summary.months).toHaveLength(6);
    const current = summary.months[5];
    expect(current.month).toBe("2026-08");
    expect(current.income).toBe(2_000_000);
    expect(current.expenses).toBe(0);
  });

  it("salary + internal transfer (both legs) shows income=salary, expense=0", () => {
    const salary = movement({ type: "income", amount: 2_000_000 });
    // Both legs of one transfer between own accounts.
    const outLeg = movement({
      type: "expense",
      amount: 500_000,
      linkKind: "transfer",
    });
    const inLeg = movement({
      type: "income",
      amount: 500_000,
      linkKind: "transfer",
    });

    const summary = computeDashboardSummary({
      movements: [salary, outLeg, inLeg],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyIncome).toBe(2_000_000);
    expect(summary.monthlyExpenses).toBe(0);
    expect(summary.months[5].income).toBe(2_000_000);
    expect(summary.months[5].expenses).toBe(0);
  });

  it("opening-balance movement is excluded from the economic result", () => {
    const salary = movement({ type: "income", amount: 2_000_000 });
    const opening = movement({
      type: "income",
      amount: 1_000_000,
      linkKind: "opening",
    });

    const summary = computeDashboardSummary({
      movements: [salary, opening],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyIncome).toBe(2_000_000);
    expect(summary.months[5].income).toBe(2_000_000);
  });

  it("keeps current cash-basis treatment for credit principals and sale payments", () => {
    const salary = movement({ type: "income", amount: 2_000_000 });
    const creditPrincipal = movement({
      type: "income",
      amount: 800_000,
      linkKind: "creditReceivedPrincipal",
    });
    const salePayment = movement({
      type: "income",
      amount: 50_000,
      linkKind: "salePayment",
    });
    const payableAbono = movement({
      type: "expense",
      amount: 120_000,
      linkKind: "payableAbono",
    });

    const summary = computeDashboardSummary({
      movements: [salary, creditPrincipal, salePayment, payableAbono],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyIncome).toBe(2_850_000);
    expect(summary.monthlyExpenses).toBe(120_000);
  });

  it("multi-currency: only the requested currency scope is aggregated", () => {
    const copSalary = movement({ type: "income", amount: 2_000_000 });
    const usdExpense = movement({
      type: "expense",
      amount: 1500,
      currency: "USD",
    });

    const inCop = computeDashboardSummary({
      movements: [copSalary, usdExpense],
      currency: "COP",
      now: NOW,
    });
    expect(inCop.monthlyIncome).toBe(2_000_000);
    expect(inCop.monthlyExpenses).toBe(0);

    const inUsd = computeDashboardSummary({
      movements: [copSalary, usdExpense],
      currency: "USD",
      now: NOW,
    });
    expect(inUsd.monthlyIncome).toBe(0);
    expect(inUsd.monthlyExpenses).toBe(1500);
  });

  it("buckets previous months by UTC year-month and pads the 6-month window", () => {
    const julySalary = movement({
      type: "income",
      amount: 100_000,
      date: new Date("2026-07-05"),
    });

    const summary = computeDashboardSummary({
      movements: [julySalary],
      currency: "COP",
      now: NOW,
    });

    expect(summary.months.map((b) => b.month)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(summary.months[4]).toEqual({
      month: "2026-07",
      income: 100_000,
      expenses: 0,
    });
    expect(summary.monthlyIncome).toBe(0);
  });
});
