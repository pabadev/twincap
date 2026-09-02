import { describe, expect, it } from "vitest";
import { computeCategorySummary } from "./compute-category-summary";
import { Movement } from "../domain/movement";
import type { MovementLinkKind, MovementType } from "../domain/movement";
import { Category } from "../domain/category";
import { Money } from "../domain/money";
import type { Currency } from "../domain/currency";

const SEED_DATE = new Date("2026-01-01");

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

function movementWithCategory(input: {
  type: MovementType;
  amount: number;
  categoryId: string;
  currency?: Currency;
  linkKind?: MovementLinkKind;
}): Movement {
  return new Movement({
    id: `m-${++seq}`,
    userId: "u1",
    accountId: "acc-1",
    category: new Category({
      id: input.categoryId,
      userId: "u1",
      name: input.categoryId,
      type: input.type,
      createdAt: SEED_DATE,
    }),
    type: input.type,
    amount: new Money(input.amount, input.currency ?? "COP"),
    date: new Date("2026-08-10"),
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

  it("multiple categories same type, sorted by amount descending", () => {
    const m1 = movementWithCategory({ type: "income", amount: 500_000, categoryId: "freelance" });
    const m2 = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const m3 = movementWithCategory({ type: "income", amount: 150_000, categoryId: "bonus" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(3);
    expect(result.incomeCategories[0]).toEqual({ categoryId: "salary", amount: 2_000_000 });
    expect(result.incomeCategories[1]).toEqual({ categoryId: "freelance", amount: 500_000 });
    expect(result.incomeCategories[2]).toEqual({ categoryId: "bonus", amount: 150_000 });
    expect(result.expenseCategories).toEqual([]);
  });

  it("mixed income and expense, multiple categories each", () => {
    const inc1 = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const inc2 = movementWithCategory({ type: "income", amount: 800_000, categoryId: "freelance" });
    const exp1 = movementWithCategory({ type: "expense", amount: 400_000, categoryId: "rent" });
    const exp2 = movementWithCategory({ type: "expense", amount: 150_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [inc1, inc2, exp1, exp2],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(2);
    expect(result.incomeCategories[0]).toEqual({ categoryId: "salary", amount: 2_000_000 });
    expect(result.incomeCategories[1]).toEqual({ categoryId: "freelance", amount: 800_000 });
    expect(result.expenseCategories).toHaveLength(2);
    expect(result.expenseCategories[0]).toEqual({ categoryId: "rent", amount: 400_000 });
    expect(result.expenseCategories[1]).toEqual({ categoryId: "food", amount: 150_000 });
    expect(result.totalIncome).toBe(2_800_000);
    expect(result.totalExpenses).toBe(550_000);
  });

  it("transfers excluded from both income and expense", () => {
    const realIncome = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const transferIncome = movementWithCategory({
      type: "income",
      amount: 500_000,
      categoryId: "transfer-in",
      linkKind: "transfer",
    });
    const realExpense = movementWithCategory({ type: "expense", amount: 300_000, categoryId: "food" });
    const transferExpense = movementWithCategory({
      type: "expense",
      amount: 500_000,
      categoryId: "transfer-out",
      linkKind: "transfer",
    });
    const result = computeCategorySummary({
      movements: [realIncome, transferIncome, realExpense, transferExpense],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0]).toEqual({ categoryId: "salary", amount: 2_000_000 });
    expect(result.expenseCategories).toHaveLength(1);
    expect(result.expenseCategories[0]).toEqual({ categoryId: "food", amount: 300_000 });
    expect(result.totalIncome).toBe(2_000_000);
    expect(result.totalExpenses).toBe(300_000);
  });

  it("opening movements excluded", () => {
    const realIncome = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const openingIncome = movementWithCategory({
      type: "income",
      amount: 1_000_000,
      categoryId: "opening-balance",
      linkKind: "opening",
    });
    const result = computeCategorySummary({
      movements: [realIncome, openingIncome],
      currency: "COP",
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0]).toEqual({ categoryId: "salary", amount: 2_000_000 });
    expect(result.totalIncome).toBe(2_000_000);
  });

  it("multi-currency: only requested currency aggregated", () => {
    const copIncome = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const usdIncome = movementWithCategory({
      type: "income",
      amount: 3000,
      categoryId: "usd-income",
      currency: "USD",
    });
    const copExpense = movementWithCategory({ type: "expense", amount: 400_000, categoryId: "food" });

    const resultCop = computeCategorySummary({
      movements: [copIncome, usdIncome, copExpense],
      currency: "COP",
    });
    expect(resultCop.incomeCategories).toHaveLength(1);
    expect(resultCop.incomeCategories[0]).toEqual({ categoryId: "salary", amount: 2_000_000 });
    expect(resultCop.expenseCategories).toHaveLength(1);
    expect(resultCop.totalIncome).toBe(2_000_000);
    expect(resultCop.totalExpenses).toBe(400_000);

    const resultUsd = computeCategorySummary({
      movements: [copIncome, usdIncome, copExpense],
      currency: "USD",
    });
    expect(resultUsd.incomeCategories).toHaveLength(1);
    expect(resultUsd.incomeCategories[0]).toEqual({ categoryId: "usd-income", amount: 3000 });
    expect(resultUsd.expenseCategories).toEqual([]);
    expect(resultUsd.totalIncome).toBe(3000);
    expect(resultUsd.totalExpenses).toBe(0);
  });

  it("empty input returns zero totals and empty arrays", () => {
    const result = computeCategorySummary({ movements: [], currency: "COP" });
    expect(result.incomeCategories).toEqual([]);
    expect(result.expenseCategories).toEqual([]);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
  });

  it("category ID preservation", () => {
    const m1 = movementWithCategory({ type: "income", amount: 1_000_000, categoryId: "salary-abc" });
    const m2 = movementWithCategory({ type: "expense", amount: 200_000, categoryId: "food-xyz" });
    const result = computeCategorySummary({
      movements: [m1, m2],
      currency: "COP",
    });
    expect(result.incomeCategories[0].categoryId).toBe("salary-abc");
    expect(result.expenseCategories[0].categoryId).toBe("food-xyz");
  });

  it("financing principals excluded; credit abonos still count", () => {
    const receivedPrincipal = movementWithCategory({
      type: "income",
      amount: 800_000,
      categoryId: "credit-in",
      linkKind: "creditReceivedPrincipal",
    });
    const grantedPrincipal = movementWithCategory({
      type: "expense",
      amount: 300_000,
      categoryId: "credit-out",
      linkKind: "creditGrantedPrincipal",
    });
    const receivedAbono = movementWithCategory({
      type: "expense",
      amount: 120_000,
      categoryId: "credit-fee",
      linkKind: "creditReceivedAbono",
    });
    const grantedAbono = movementWithCategory({
      type: "income",
      amount: 150_000,
      categoryId: "loan-fee",
      linkKind: "creditGrantedAbonoInterest",
    });

    const result = computeCategorySummary({
      movements: [receivedPrincipal, grantedPrincipal, receivedAbono, grantedAbono],
      currency: "COP",
    });

    expect(result.incomeCategories).toEqual([{ categoryId: "loan-fee", amount: 150_000 }]);
    expect(result.expenseCategories).toEqual([{ categoryId: "credit-fee", amount: 120_000 }]);
    expect(result.totalIncome).toBe(150_000);
    expect(result.totalExpenses).toBe(120_000);
  });
});
