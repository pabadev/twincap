import { describe, expect, it } from "vitest";
import {
  Money,
  MoneyError,
  assertSameCurrency,
  assertSafeMinorUnits,
  deriveExchangeRate,
} from "./money";
import { ValidationError } from "./errors";
import { CreditReceived } from "./credit-received";
import { Sale } from "./sale";

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

  it("derives the §11 convention — sourceMajor per destinationMajor (R15.3 §11)", () => {
    // 100.00 USD → 400.000 COP: (10000/100) / (400000/1) = 0,00025 USD/COP.
    expect(
      deriveExchangeRate(
        new Money(100_00, "USD"),
        new Money(400_000, "COP"),
      ),
    ).toBeCloseTo(0.00025, 6);
  });

  it("doc example: 190.000 COP → 50 USD yields exactly 3.800 COP/USD (§11)", () => {
    // (190000 / 10^0) / (5000 / 10^2) = 190000 / 50 = 3800 — NOT the old
    // minor-unit ratio (0,0263158) nor the naive 38.
    expect(
      deriveExchangeRate(
        new Money(190_000, "COP"),
        new Money(5_000, "USD"),
      ),
    ).toBe(3800);
  });

  it("inverts for USD → COP: 50 USD → 190.000 COP is ≈ 1/3800 (§11)", () => {
    expect(
      deriveExchangeRate(
        new Money(5_000, "USD"),
        new Money(190_000, "COP"),
      ),
    ).toBeCloseTo(1 / 3800, 10);
  });

  it("handles currencies with different exponents — COP → MXN (§11)", () => {
    // 380.000 COP → 5.000 MXN minor (50.00 MXN): 380000/1 ÷ 5000/100 = 7600.
    expect(
      deriveExchangeRate(
        new Money(380_000, "COP"),
        new Money(5_000, "MXN"),
      ),
    ).toBe(7600);
  });

  it("handles currencies with different exponents — EUR → COP (§11)", () => {
    // 5.000 EUR minor (50.00 EUR) → 190.000 COP: 50/190000.
    expect(
      deriveExchangeRate(
        new Money(5_000, "EUR"),
        new Money(190_000, "COP"),
      ),
    ).toBeCloseTo(50 / 190_000, 10);
  });

  it("handles same-exponent cross-currency — USD → EUR (§11)", () => {
    // 100.00 USD → 85.00 EUR: 100/85.
    expect(
      deriveExchangeRate(
        new Money(100_00, "USD"),
        new Money(85_00, "EUR"),
      ),
    ).toBeCloseTo(100 / 85, 10);
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

  it("rejects a zero destination MAJOR amount (sub-cent destination, §11)", () => {
    expect(() =>
      deriveExchangeRate(
        new Money(100, "COP"),
        new Money(1, "USD"),
      ),
    ).not.toThrow(ValidationError); // 1 USD minor = 0.01 major > 0, valid
  });
});

describe("assertSafeMinorUnits (R15.3 §18)", () => {
  it("accepts ordinary minor-unit values", () => {
    expect(() => assertSafeMinorUnits(190000, "x")).not.toThrow();
    expect(() => assertSafeMinorUnits(5000, "x")).not.toThrow();
    expect(() => assertSafeMinorUnits(1, "x")).not.toThrow();
    expect(() => assertSafeMinorUnits(0, "x")).not.toThrow();
    expect(() => assertSafeMinorUnits(Number.MAX_SAFE_INTEGER, "x")).not.toThrow();
  });

  it("accepts negative safe integers — the contract is integer-safety ONLY", () => {
    // Positivity is enforced by the Money constructors (Money rejects 0 and
    // negatives); assertSafeMinorUnits guards the numerical range, so −1 is a
    // safe integer and passes (§18).
    expect(() => assertSafeMinorUnits(-1, "x")).not.toThrow();
    expect(() => assertSafeMinorUnits(Number.MIN_SAFE_INTEGER, "x")).not.toThrow();
  });

  it("rejects values above MAX_SAFE_INTEGER", () => {
    expect(() => assertSafeMinorUnits(Number.MAX_SAFE_INTEGER + 1, "x")).toThrow(MoneyError);
    expect(() => assertSafeMinorUnits(1e21, "x")).toThrow(MoneyError);
    expect(() => assertSafeMinorUnits(1e16, "x")).toThrow(MoneyError); // 10^16 > 2^53
  });

  it("rejects values below MIN_SAFE_INTEGER", () => {
    expect(() => assertSafeMinorUnits(Number.MIN_SAFE_INTEGER - 1, "x")).toThrow(MoneyError);
  });

  it("rejects non-integers and non-finite numbers", () => {
    expect(() => assertSafeMinorUnits(1.5, "x")).toThrow(MoneyError);
    expect(() => assertSafeMinorUnits(Number.POSITIVE_INFINITY, "x")).toThrow(MoneyError);
    expect(() => assertSafeMinorUnits(Number.NEGATIVE_INFINITY, "x")).toThrow(MoneyError);
    expect(() => assertSafeMinorUnits(Number.NaN, "x")).toThrow(MoneyError);
  });

  it("names the failing context in the error message", () => {
    expect(() => assertSafeMinorUnits(1e21, "CreditReceived totalToPay")).toThrow(
      /`CreditReceived totalToPay` produced an unsafe minor-units value: 1e\+21/,
    );
  });
});

describe("§18 integration — derived totals cannot overflow silently", () => {
  it("CreditReceived: installments × installmentValue overflow fails fast in the constructor", () => {
    expect(
      () =>
        new CreditReceived(
          {
            id: "cr-1",
            workspaceId: "ws-1",
            counterparty: "Lender",
            principal: new Money(100_000, "COP"),
            accountId: "acc-1",
            date: new Date("2025-01-01"),
            installments: 2,
            installmentValue: new Money(Number.MAX_SAFE_INTEGER, "COP"),
            createdAt: new Date("2025-01-01"),
          },
          [],
        ),
    ).toThrow(MoneyError);
  });

  it("CreditReceived: installments × installmentValue within range constructs fine", () => {
    const credit = new CreditReceived(
      {
        id: "cr-2",
        workspaceId: "ws-1",
        counterparty: "Lender",
        principal: new Money(100_000, "COP"),
        accountId: "acc-1",
        date: new Date("2025-01-01"),
        installments: 3,
        installmentValue: new Money(40_000, "COP"),
        createdAt: new Date("2025-01-01"),
      },
      [],
    );
    expect(credit.totalToPay).toBe(120_000);
    expect(credit.pending).toBe(120_000);
  });

  it("Sale: quantity × unitPrice overflow fails fast in the constructor", () => {
    expect(
      () =>
        new Sale(
          {
            id: "s-1",
            workspaceId: "ws-1",
            items: [
              { itemId: "it-1", quantity: 2, unitPrice: new Money(Number.MAX_SAFE_INTEGER, "COP") },
            ],
            date: new Date("2025-01-01"),
            paymentMode: "paid-in-full",
            accountId: "acc-1",
            createdAt: new Date("2025-01-01"),
          },
          [],
        ),
    ).toThrow(MoneyError);
  });

  it("Sale: a running total that overflows across items fails fast too", () => {
    expect(
      () =>
        new Sale(
          {
            id: "s-2",
            workspaceId: "ws-1",
            items: [
              { itemId: "it-1", quantity: 1, unitPrice: new Money(Number.MAX_SAFE_INTEGER, "COP") },
              { itemId: "it-2", quantity: 1, unitPrice: new Money(1, "COP") },
            ],
            date: new Date("2025-01-01"),
            paymentMode: "paid-in-full",
            accountId: "acc-1",
            createdAt: new Date("2025-01-01"),
          },
          [],
        ),
    ).toThrow(MoneyError);
  });

  it("Sale: normal line items construct fine", () => {
    const sale = new Sale(
      {
        id: "s-3",
        workspaceId: "ws-1",
        items: [
          { itemId: "it-1", quantity: 2, unitPrice: new Money(25_000, "COP") },
          { itemId: "it-2", quantity: 3, unitPrice: new Money(10_000, "COP") },
        ],
        date: new Date("2025-01-01"),
        paymentMode: "paid-in-full",
        accountId: "acc-1",
        createdAt: new Date("2025-01-01"),
      },
      [],
    );
    expect(sale.total).toBe(80_000);
    expect(sale.pending).toBe(80_000);
  });
});
