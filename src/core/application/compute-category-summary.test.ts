import { describe, expect, it } from "vitest";
import { computeCategorySummary } from "./compute-category-summary";
import { Movement } from "../domain/movement";
import type { MovementLinkKind, MovementType } from "../domain/movement";
import { Category } from "../domain/category";
import { Money } from "../domain/money";
import type { Currency } from "../domain/currency";

const SEED_DATE = new Date("2026-01-01");
const NOW = new Date("2026-08-20T12:00:00Z");

function category(type: MovementType, id?: string): Category {
  return new Category({
    id: id ?? `cat-${type}`,
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
  categoryId?: string;
  categoryType?: MovementType;
  currency?: Currency;
  date?: Date;
  linkKind?: MovementLinkKind;
}): Movement {
  return new Movement({
    id: `m-${++seq}`,
    userId: "u1",
    accountId: "acc-1",
    category: category(input.categoryType ?? input.type, input.categoryId),
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

describe("computeCategorySummary", () => {
  it("no movements: returns empty arrays and zero totals", () => {
    const result = computeCategorySummary({ movements: [], currency: "COP" });
    expect(result.incomeCategories).toEqual([]);
    expect(result.expenseCategories).toEqual([]);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
  });

  it("single income category", () => {
    const m = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const result = computeCategorySummary({ movements: [m], currency: "COP" });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0]).toEqual({ categoryId: "salary", amount: 2_000_000 });
    expect(result.totalIncome).toBe(2_000_000);
    expect(result.expenseCategories).toEqual([]);
    expect(result.totalExpenses).toBe(0);
  });

  it("multiple income categories: sorted by amount descending", () => {
    const m1 = movement({ type: "income", amount: 500_000, categoryId: "freelance" });
    const m2 = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const m3 = movement({ type: "income", amount: 100_000, categoryId: "bonus" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(3);
    expect(result.incomeCategories[0].categoryId).toBe("salary");
    expect(result.incomeCategories[1].categoryId).toBe("freelance");
    expect(result.incomeCategories[2].categoryId).toBe("bonus");
    expect(result.totalIncome).toBe(2_600_000);
  });

  it("multiple expense categories: sorted by amount descending", () => {
    const m1 = movement({ type: "expense", amount: 50_000, categoryId: "transport" });
    const m2 = movement({ type: "expense", amount: 300_000, categoryId: "rent" });
    const m3 = movement({ type: "expense", amount: 120_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
      currency: "COP",
    });
    expect(result.expenseCategories).toHaveLength(3);
    expect(result.expenseCategories[0].categoryId).toBe("rent");
    expect(result.expenseCategories[1].categoryId).toBe("food");
    expect(result.expenseCategories[2].categoryId).toBe("transport");
    expect(result.totalExpenses).toBe(470_000);
  });

  it("mixed income and expense", () => {
    const income = movement({ type: "income", amount: 1_000_000, categoryId: "salary" });
    const expense = movement({ type: "expense", amount: 200_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [income, expense],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.expenseCategories).toHaveLength(1);
    expect(result.totalIncome).toBe(1_000_000);
    expect(result.totalExpenses).toBe(200_000);
  });

  it("transfers excluded", () => {
    const salary = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const transfer = movement({
      type: "expense",
      amount: 500_000,
      categoryId: "salary",
      linkKind: "transfer",
    });
    const result = computeCategorySummary({
      movements: [salary, transfer],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0].amount).toBe(2_000_000);
    expect(result.expenseCategories).toEqual([]);
    expect(result.totalExpenses).toBe(0);
  });

  it("opening excluded", () => {
    const salary = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const opening = movement({
      type: "income",
      amount: 1_000_000,
      categoryId: "salary",
      linkKind: "opening",
    });
    const result = computeCategorySummary({
      movements: [salary, opening],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0].amount).toBe(2_000_000);
  });

  it("multi-currency: only requested currency is aggregated", () => {
    const copIncome = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const usdExpense = movement({
      type: "expense",
      amount: 1500,
      categoryId: "food",
      currency: "USD",
    });
    const resultCop = computeCategorySummary({
      movements: [copIncome, usdExpense],
      currency: "COP",
    });
    expect(resultCop.totalIncome).toBe(2_000_000);
    expect(resultCop.totalExpenses).toBe(0);

    const resultUsd = computeCategorySummary({
      movements: [copIncome, usdExpense],
      currency: "USD",
    });
    expect(resultUsd.totalIncome).toBe(0);
    expect(resultUsd.totalExpenses).toBe(1500);
  });

  it("different categories same type: each gets its own bucket", () => {
    const m1 = movement({ type: "expense", amount: 100_000, categoryId: "food" });
    const m2 = movement({ type: "expense", amount: 100_000, categoryId: "transport" });
    const m3 = movement({ type: "expense", amount: 100_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
      currency: "COP",
    });
    expect(result.expenseCategories).toHaveLength(2);
    const food = result.expenseCategories.find((c) => c.categoryId === "food");
    const transport = result.expenseCategories.find((c) => c.categoryId === "transport");
    expect(food?.amount).toBe(200_000);
    expect(transport?.amount).toBe(100_000);
  });
});
