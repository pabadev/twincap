import { describe, expect, it } from "vitest";
import {
  Money,
  MoneyError,
  assertSameCurrency,
  deriveExchangeRate,
} from "./money";
import { ValidationError } from "./errors";

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

  it("re-validates the plus result and rejects non-safe-integer overflow (R15.2 D5)", () => {
    expect(() =>
      new Money(Number.MAX_SAFE_INTEGER, "COP").plus(new Money(1, "COP")),
    ).toThrow(MoneyError);
    expect(() =>
      new Money(Number.MAX_SAFE_INTEGER, "COP").plus(new Money(1, "COP")),
    ).toThrow(/after plus/);
  });

  it("re-validates the minus result and rejects non-positive results (R15.2 D5)", () => {
    expect(() => new Money(500, "COP").minus(new Money(700, "COP"))).toThrow(
      MoneyError,
    );
    // Zero result (x − x) is not a valid transactional amount either.
    expect(() => new Money(500, "COP").minus(new Money(500, "COP"))).toThrow(
      /after minus/,
    );
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

describe("deriveExchangeRate", () => {
  it("returns 1 for same-currency amounts (TRA-2)", () => {
    expect(
      deriveExchangeRate(new Money(300_000, "COP"), new Money(300_000, "COP")),
    ).toBe(1);
  });

  it("derives destination/source ratio for cross-currency amounts (TRA-3)", () => {
    expect(
      deriveExchangeRate(
        new Money(100_00, "USD"),
        new Money(400_000, "COP"),
      ),
    ).toBe(40); // 400_000 / 10_000
  });

  it("rejects a zero source amount", () => {
    expect(() =>
      deriveExchangeRate(
        Money.nonNegative(0, "COP"),
        new Money(100, "COP"),
      ),
    ).toThrow(ValidationError);
  });

  it("rejects a zero destination amount", () => {
    expect(() =>
      deriveExchangeRate(
        new Money(100, "COP"),
        Money.nonNegative(0, "COP"),
      ),
    ).toThrow(ValidationError);
  });
});
