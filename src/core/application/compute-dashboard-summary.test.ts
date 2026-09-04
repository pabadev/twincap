import { describe, expect, it } from "vitest";
import { computeDashboardSummary } from "./compute-dashboard-summary";
import { Movement } from "../domain/movement";
import type { MovementContext, MovementLinkKind, MovementType } from "../domain/movement";
import { Category } from "../domain/category";
import { Money } from "../domain/money";
import type { Currency } from "../domain/currency";

const SEED_DATE = new Date("2026-01-01");
/** Fixed "today" inside the test window: August 2026 (current month). */
const NOW = new Date("2026-08-20T12:00:00Z");

function category(type: MovementType): Category {
  return new Category({
    id: `cat-${type}`,
    workspaceId: "u1",
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
  context?: MovementContext;
}): Movement {
  return new Movement({
    id: `m-${++seq}`,
    workspaceId: "u1",
    accountId: "acc-1",
    category: category(input.type),
    type: input.type,
    amount: new Money(input.amount, input.currency ?? "COP"),
    date: input.date ?? new Date("2026-08-10"),
    context: input.context ?? "Personal",
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

  it("excludes financing capital from the economic result but keeps abonos, sales and payables", () => {
    const salary = movement({ type: "income", amount: 2_000_000 });
    const creditReceivedPrincipal = movement({
      type: "income",
      amount: 800_000,
      linkKind: "creditReceivedPrincipal",
    });
    const creditGrantedPrincipal = movement({
      type: "expense",
      amount: 300_000,
      linkKind: "creditGrantedPrincipal",
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
      movements: [
        salary,
        creditReceivedPrincipal,
        creditGrantedPrincipal,
        salePayment,
        payableAbono,
      ],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyIncome).toBe(2_050_000);
    expect(summary.monthlyExpenses).toBe(120_000);
    expect(summary.financingInflow).toBe(800_000);
    expect(summary.financingOutflow).toBe(300_000);
  });

  it("creditReceivedPrincipal: not income, but financing inflow of the current month", () => {
    const creditReceivedPrincipal = movement({
      type: "income",
      amount: 800_000,
      linkKind: "creditReceivedPrincipal",
    });

    const summary = computeDashboardSummary({
      movements: [creditReceivedPrincipal],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyIncome).toBe(0);
    expect(summary.financingInflow).toBe(800_000);
    expect(summary.financingOutflow).toBe(0);
    expect(summary.months[5].income).toBe(0);
  });

  it("creditGrantedPrincipal: not expense, but financing outflow of the current month", () => {
    const creditGrantedPrincipal = movement({
      type: "expense",
      amount: 300_000,
      linkKind: "creditGrantedPrincipal",
    });

    const summary = computeDashboardSummary({
      movements: [creditGrantedPrincipal],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyExpenses).toBe(0);
    expect(summary.financingInflow).toBe(0);
    expect(summary.financingOutflow).toBe(300_000);
    expect(summary.months[5].expenses).toBe(0);
  });

  it("financing flows default to zero when no financing capital exists", () => {
    const salary = movement({ type: "income", amount: 2_000_000 });
    const summary = computeDashboardSummary({
      movements: [salary],
      currency: "COP",
      now: NOW,
    });

    expect(summary.financingInflow).toBe(0);
    expect(summary.financingOutflow).toBe(0);
  });

  it("financing flows only count the current month, other currencies are ignored", () => {
    const pastCredit = movement({
      type: "income",
      amount: 100_000,
      date: new Date("2026-07-10"),
      linkKind: "creditReceivedPrincipal",
    });
    const usdCredit = movement({
      type: "income",
      amount: 800,
      currency: "USD",
      linkKind: "creditReceivedPrincipal",
    });

    const summary = computeDashboardSummary({
      movements: [pastCredit, usdCredit],
      currency: "COP",
      now: NOW,
    });

    expect(summary.financingInflow).toBe(0);
    expect(summary.financingOutflow).toBe(0);
  });

  it("creditReceivedAbono (quota paid) still counts as expense", () => {
    const abono = movement({
      type: "expense",
      amount: 120_000,
      linkKind: "creditReceivedAbono",
    });

    const summary = computeDashboardSummary({
      movements: [abono],
      currency: "COP",
      now: NOW,
    });

    expect(summary.monthlyExpenses).toBe(120_000);
    expect(summary.months[5].expenses).toBe(120_000);
  });

  it("creditGrantedAbono: standalone (Personal) recovery is NOT income; POS initial payment (Business) still is", () => {
    const standaloneAbono = movement({
      type: "income",
      amount: 150_000,
      linkKind: "creditGrantedAbono",
    });
    const posInitialPayment = movement({
      type: "income",
      amount: 200_000,
      linkKind: "creditGrantedAbono",
      context: "Business",
    });

    const summary = computeDashboardSummary({
      movements: [standaloneAbono, posInitialPayment],
      currency: "COP",
      now: NOW,
    });

    // Standalone recovery excludes capital; POS initial payment is commercial income.
    expect(summary.monthlyIncome).toBe(200_000);
    expect(summary.months[5].income).toBe(200_000);
    expect(summary.financingInflow).toBe(0);
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

  it("A2 boundary: UTC already Sep 1 but civil Aug 31 at UTC-5 — window stays on August", () => {
    // 2026-09-01T02:00:00Z = Aug 31 21:00 local in UTC-5 (tzOffsetMinutes
    // 300): the current month must stay 2026-08 and the 6-month window must
    // anchor there, otherwise the dashboard empties at month-end evenings.
    const aug31 = movement({
      type: "income",
      amount: 500_000,
      date: new Date("2026-08-31"),
    });
    const sep1 = movement({
      type: "expense",
      amount: 100_000,
      date: new Date("2026-09-01"),
    });

    const summary = computeDashboardSummary({
      movements: [aug31, sep1],
      currency: "COP",
      now: new Date("2026-09-01T02:00:00Z"),
      tzOffsetMinutes: 300,
    });

    expect(summary.monthlyIncome).toBe(500_000);
    expect(summary.monthlyExpenses).toBe(0);
    expect(summary.months.map((b) => b.month)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(summary.months[5].income).toBe(500_000);
  });
});
