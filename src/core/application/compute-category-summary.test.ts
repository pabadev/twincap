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
  categoryId?: string;
  categoryType?: MovementType;
  currency?: Currency;
  date?: Date;
  linkKind?: MovementLinkKind;
}): Movement {
  return new Movement({
    id: `m-${++seq}`,
    workspaceId: "u1",
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
    workspaceId: "u1",
    accountId: "acc-1",
    category: new Category({
      id: input.categoryId,
      workspaceId: "u1",
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
  it("no movements: returns empty arrays and totals", () => {
    const result = computeCategorySummary({ movements: [] });
    expect(result.incomeCategories).toEqual([]);
    expect(result.expenseCategories).toEqual([]);
    expect(result.incomeTotals).toEqual([]);
    expect(result.expenseTotals).toEqual([]);
  });

  it("single income category", () => {
    const m = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const result = computeCategorySummary({ movements: [m] });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0]).toEqual({
      categoryId: "salary",
      currency: "COP",
      amount: 2_000_000,
    });
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 2_000_000 }]);
    expect(result.expenseCategories).toEqual([]);
    expect(result.expenseTotals).toEqual([]);
  });

  it("multiple income categories: sorted by amount descending", () => {
    const m1 = movement({ type: "income", amount: 500_000, categoryId: "freelance" });
    const m2 = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const m3 = movement({ type: "income", amount: 100_000, categoryId: "bonus" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
    });
    expect(result.incomeCategories).toHaveLength(3);
    expect(result.incomeCategories[0].categoryId).toBe("salary");
    expect(result.incomeCategories[1].categoryId).toBe("freelance");
    expect(result.incomeCategories[2].categoryId).toBe("bonus");
    expect(result.incomeCategories.every((c) => c.currency === "COP")).toBe(true);
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 2_600_000 }]);
  });

  it("multiple expense categories: sorted by amount descending", () => {
    const m1 = movement({ type: "expense", amount: 50_000, categoryId: "transport" });
    const m2 = movement({ type: "expense", amount: 300_000, categoryId: "rent" });
    const m3 = movement({ type: "expense", amount: 120_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
    });
    expect(result.expenseCategories).toHaveLength(3);
    expect(result.expenseCategories[0].categoryId).toBe("rent");
    expect(result.expenseCategories[1].categoryId).toBe("food");
    expect(result.expenseCategories[2].categoryId).toBe("transport");
    expect(result.expenseTotals).toEqual([{ currency: "COP", value: 470_000 }]);
  });

  it("mixed income and expense", () => {
    const income = movement({ type: "income", amount: 1_000_000, categoryId: "salary" });
    const expense = movement({ type: "expense", amount: 200_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [income, expense],
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.expenseCategories).toHaveLength(1);
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 1_000_000 }]);
    expect(result.expenseTotals).toEqual([{ currency: "COP", value: 200_000 }]);
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
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0].amount).toBe(2_000_000);
    expect(result.expenseCategories).toEqual([]);
    expect(result.expenseTotals).toEqual([]);
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
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0].amount).toBe(2_000_000);
  });

  it("multi-currency: every currency is aggregated, COP gets its own rows", () => {
    const copIncome = movement({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const usdExpense = movement({
      type: "expense",
      amount: 1500,
      categoryId: "food",
      currency: "USD",
    });
    const result = computeCategorySummary({
      movements: [copIncome, usdExpense],
    });
    // Neither currency is dropped — each keeps its own rows and totals.
    expect(result.incomeCategories).toEqual([
      { categoryId: "salary", currency: "COP", amount: 2_000_000 },
    ]);
    expect(result.expenseCategories).toEqual([
      { categoryId: "food", currency: "USD", amount: 1500 },
    ]);
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 2_000_000 }]);
    expect(result.expenseTotals).toEqual([{ currency: "USD", value: 1500 }]);
  });

  it("multi-currency same category: bucketed per (currency, category)", () => {
    const copSalary = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const usdSalary = movementWithCategory({
      type: "income",
      amount: 3000,
      categoryId: "salary",
      currency: "USD",
    });
    const result = computeCategorySummary({
      movements: [copSalary, usdSalary],
    });
    // Same categoryId in two currencies → two rows, never summed together.
    expect(result.incomeCategories).toEqual([
      { categoryId: "salary", currency: "COP", amount: 2_000_000 },
      { categoryId: "salary", currency: "USD", amount: 3000 },
    ]);
    expect(result.incomeTotals).toEqual([
      { currency: "COP", value: 2_000_000 },
      { currency: "USD", value: 3000 },
    ]);
  });

  it("different categories same type: each gets its own bucket", () => {
    const m1 = movement({ type: "expense", amount: 100_000, categoryId: "food" });
    const m2 = movement({ type: "expense", amount: 100_000, categoryId: "transport" });
    const m3 = movement({ type: "expense", amount: 100_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
    });
    expect(result.expenseCategories).toHaveLength(2);
    const food = result.expenseCategories.find((c) => c.categoryId === "food");
    const transport = result.expenseCategories.find((c) => c.categoryId === "transport");
    expect(food?.amount).toBe(200_000);
    expect(food?.currency).toBe("COP");
    expect(transport?.amount).toBe(100_000);
  });

  it("multiple categories same type, sorted by amount descending", () => {
    const m1 = movementWithCategory({ type: "income", amount: 500_000, categoryId: "freelance" });
    const m2 = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const m3 = movementWithCategory({ type: "income", amount: 150_000, categoryId: "bonus" });
    const result = computeCategorySummary({
      movements: [m1, m2, m3],
    });
    expect(result.incomeCategories).toHaveLength(3);
    expect(result.incomeCategories[0]).toEqual({
      categoryId: "salary",
      currency: "COP",
      amount: 2_000_000,
    });
    expect(result.incomeCategories[1]).toEqual({
      categoryId: "freelance",
      currency: "COP",
      amount: 500_000,
    });
    expect(result.incomeCategories[2]).toEqual({
      categoryId: "bonus",
      currency: "COP",
      amount: 150_000,
    });
    expect(result.expenseCategories).toEqual([]);
  });

  it("mixed income and expense, multiple categories each", () => {
    const inc1 = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const inc2 = movementWithCategory({ type: "income", amount: 800_000, categoryId: "freelance" });
    const exp1 = movementWithCategory({ type: "expense", amount: 400_000, categoryId: "rent" });
    const exp2 = movementWithCategory({ type: "expense", amount: 150_000, categoryId: "food" });
    const result = computeCategorySummary({
      movements: [inc1, inc2, exp1, exp2],
    });
    expect(result.incomeCategories).toHaveLength(2);
    expect(result.incomeCategories[0]).toEqual({
      categoryId: "salary",
      currency: "COP",
      amount: 2_000_000,
    });
    expect(result.incomeCategories[1]).toEqual({
      categoryId: "freelance",
      currency: "COP",
      amount: 800_000,
    });
    expect(result.expenseCategories).toHaveLength(2);
    expect(result.expenseCategories[0]).toEqual({
      categoryId: "rent",
      currency: "COP",
      amount: 400_000,
    });
    expect(result.expenseCategories[1]).toEqual({
      categoryId: "food",
      currency: "COP",
      amount: 150_000,
    });
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 2_800_000 }]);
    expect(result.expenseTotals).toEqual([{ currency: "COP", value: 550_000 }]);
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
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0]).toEqual({
      categoryId: "salary",
      currency: "COP",
      amount: 2_000_000,
    });
    expect(result.expenseCategories).toHaveLength(1);
    expect(result.expenseCategories[0]).toEqual({
      categoryId: "food",
      currency: "COP",
      amount: 300_000,
    });
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 2_000_000 }]);
    expect(result.expenseTotals).toEqual([{ currency: "COP", value: 300_000 }]);
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
    });
    expect(result.incomeCategories).toHaveLength(1);
    expect(result.incomeCategories[0]).toEqual({
      categoryId: "salary",
      currency: "COP",
      amount: 2_000_000,
    });
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 2_000_000 }]);
  });

  it("multi-currency income and expense: rows and totals keep both currencies, COP-first", () => {
    const copIncome = movementWithCategory({ type: "income", amount: 2_000_000, categoryId: "salary" });
    const usdIncome = movementWithCategory({
      type: "income",
      amount: 3000,
      categoryId: "usd-income",
      currency: "USD",
    });
    const copExpense = movementWithCategory({ type: "expense", amount: 400_000, categoryId: "food" });

    const result = computeCategorySummary({
      movements: [copIncome, usdIncome, copExpense],
    });
    // COP rows first, then USD; within each currency sorted by amount desc.
    expect(result.incomeCategories).toEqual([
      { categoryId: "salary", currency: "COP", amount: 2_000_000 },
      { categoryId: "usd-income", currency: "USD", amount: 3000 },
    ]);
    expect(result.expenseCategories).toEqual([
      { categoryId: "food", currency: "COP", amount: 400_000 },
    ]);
    expect(result.incomeTotals).toEqual([
      { currency: "COP", value: 2_000_000 },
      { currency: "USD", value: 3000 },
    ]);
    expect(result.expenseTotals).toEqual([{ currency: "COP", value: 400_000 }]);
  });

  it("empty input returns empty arrays and totals", () => {
    const result = computeCategorySummary({ movements: [] });
    expect(result.incomeCategories).toEqual([]);
    expect(result.expenseCategories).toEqual([]);
    expect(result.incomeTotals).toEqual([]);
    expect(result.expenseTotals).toEqual([]);
  });

  it("category ID preservation", () => {
    const m1 = movementWithCategory({ type: "income", amount: 1_000_000, categoryId: "salary-abc" });
    const m2 = movementWithCategory({ type: "expense", amount: 200_000, categoryId: "food-xyz" });
    const result = computeCategorySummary({
      movements: [m1, m2],
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
    });

    expect(result.incomeCategories).toEqual([
      { categoryId: "loan-fee", currency: "COP", amount: 150_000 },
    ]);
    expect(result.expenseCategories).toEqual([
      { categoryId: "credit-fee", currency: "COP", amount: 120_000 },
    ]);
    expect(result.incomeTotals).toEqual([{ currency: "COP", value: 150_000 }]);
    expect(result.expenseTotals).toEqual([{ currency: "COP", value: 120_000 }]);
  });
});