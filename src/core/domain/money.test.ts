import { describe, expect, it } from "vitest";
import { Money, MoneyError, assertSameCurrency } from "./money";

describe("Money", () => {
  it("stores amounts as integer minor units with a currency", () => {
    const money = new Money(1_000_000, "COP");
    expect(money.amount).toBe(1_000_000);
    expect(money.currency).toBe("COP");
  });

  it("rejects fractional minor units", () => {
    expect(() => new Money(100.5, "COP")).toThrow(MoneyError);
  });

  it("rejects non-positive amounts", () => {
    expect(() => new Money(0, "COP")).toThrow(MoneyError);
    expect(() => new Money(-50, "COP")).toThrow(MoneyError);
  });

  it("rejects unknown currencies", () => {
    expect(() => new Money(100, "ARS" as never)).toThrow(MoneyError);
  });

  it("adds same-currency amounts", () => {
    const sum = new Money(300_000, "COP").plus(new Money(200_000, "COP"));
    expect(sum).toEqual(new Money(500_000, "COP"));
  });

  it("subtracts same-currency amounts", () => {
    const diff = new Money(500_000, "COP").minus(new Money(200_000, "COP"));
    expect(diff).toEqual(new Money(300_000, "COP"));
  });

  it("enforces the same-currency guard on plus", () => {
    expect(() => new Money(100, "USD").plus(new Money(100, "COP"))).toThrow(/Currency mismatch/);
  });

  it("enforces the same-currency guard on minus", () => {
    expect(() => new Money(100, "USD").minus(new Money(100, "EUR"))).toThrow(/Currency mismatch/);
  });

  it("compares by amount and currency", () => {
    expect(new Money(100, "USD").equals(new Money(100, "USD"))).toBe(true);
    expect(new Money(100, "USD").equals(new Money(100, "EUR"))).toBe(false);
    expect(new Money(100, "USD").equals(new Money(200, "USD"))).toBe(false);
  });

  it("guards standalone comparisons between currencies", () => {
    expect(() => assertSameCurrency(new Money(1, "USD"), new Money(1, "MXN"))).toThrow(
      MoneyError,
    );
  });
});
