import { describe, expect, it } from "vitest";
import { computeProjectedBalance, shouldShowF5 } from "./movement-f5";

describe("computeProjectedBalance", () => {
  it("subtracts the amount from a valid balance", () => {
    expect(computeProjectedBalance(5000, 3000)).toBe(2000);
  });

  it("yields a negative projection when the amount exceeds the balance", () => {
    expect(computeProjectedBalance(5000, 10000)).toBe(-5000);
  });

  it("returns undefined when the balance is missing (fail-open)", () => {
    expect(computeProjectedBalance(undefined, 1000)).toBeUndefined();
  });

  it("returns undefined when the balance is not a finite number (fail-open)", () => {
    expect(computeProjectedBalance(NaN, 1000)).toBeUndefined();
    expect(computeProjectedBalance(Infinity, 1000)).toBeUndefined();
  });
});

describe("shouldShowF5", () => {
  const negativeExpense = {
    currentBalance: 5000,
    amount: 10000,
    currency: "COP",
    accountCurrency: "COP",
    isExpense: true,
  };

  it("returns true when an expense would drive the balance negative", () => {
    expect(shouldShowF5(negativeExpense)).toBe(true);
  });

  it("returns false when the projected balance stays at or above zero", () => {
    expect(shouldShowF5({ ...negativeExpense, amount: 5000 })).toBe(false);
    expect(shouldShowF5({ ...negativeExpense, amount: 3000 })).toBe(false);
  });

  it("returns false for income regardless of the projection", () => {
    expect(shouldShowF5({ ...negativeExpense, isExpense: false })).toBe(false);
  });

  it("returns false on a cross-currency mismatch even when the projection is negative (D6)", () => {
    expect(shouldShowF5({ ...negativeExpense, accountCurrency: "USD" })).toBe(false);
  });

  it("returns false when the account has no live balance (fail-open)", () => {
    expect(shouldShowF5({ ...negativeExpense, currentBalance: undefined })).toBe(false);
  });

  it("returns true when the account is already negative", () => {
    expect(shouldShowF5({ ...negativeExpense, currentBalance: -2000, amount: 1000 })).toBe(true);
  });

  it("returns false when the amount is zero or negative (nothing to gate)", () => {
    expect(shouldShowF5({ ...negativeExpense, amount: 0 })).toBe(false);
    expect(shouldShowF5({ ...negativeExpense, amount: -500 })).toBe(false);
  });
});
