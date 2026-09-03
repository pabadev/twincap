import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { Money } from "./money";
import { Transfer } from "./transfer";

const DATE = new Date("2026-01-01T00:00:00Z");

function transfer(overrides: Partial<ConstructorParameters<typeof Transfer>[0]> = {}): Transfer {
  return new Transfer({
    id: "t1",
    workspaceId: "u1",
    sourceAccountId: "a-src",
    destinationAccountId: "a-dst",
    sourceAmount: new Money(300_000, "COP"),
    destinationAmount: new Money(300_000, "COP"),
    sourceCurrency: "COP",
    destinationCurrency: "COP",
    date: DATE,
    createdAt: DATE,
    ...overrides,
  });
}

describe("Transfer entity", () => {
  it("creates a same-currency transfer with equal amounts (TRA-2)", () => {
    const t = transfer();
    expect(t.sourceAmount.amount).toBe(300_000);
    expect(t.destinationAmount.amount).toBe(300_000);
    expect(t.sourceCurrency).toBe("COP");
    expect(t.destinationCurrency).toBe("COP");
    expect(t.rate).toBeUndefined();
  });

  it("creates a cross-currency transfer with rate (TRA-3)", () => {
    const t = transfer({
      sourceAmount: new Money(100_00, "USD"),
      destinationAmount: new Money(400_000, "COP"),
      sourceCurrency: "USD",
      destinationCurrency: "COP",
      rate: 4000,
    });
    expect(t.rate).toBe(4000);
    expect(t.sourceAmount.currency).toBe("USD");
    expect(t.destinationAmount.currency).toBe("COP");
  });

  it("rejects same-currency transfer with unequal amounts (TRA-2)", () => {
    expect(() =>
      transfer({
        sourceAmount: new Money(300_000, "COP"),
        destinationAmount: new Money(350_000, "COP"),
      }),
    ).toThrow(ValidationError);
  });

  it("rejects cross-currency transfer without rate (TRA-3)", () => {
    expect(() =>
      transfer({
        sourceAmount: new Money(100_00, "USD"),
        destinationAmount: new Money(400_000, "COP"),
        sourceCurrency: "USD",
        destinationCurrency: "COP",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects cross-currency transfer with zero rate", () => {
    expect(() =>
      transfer({
        sourceAmount: new Money(100_00, "USD"),
        destinationAmount: new Money(400_000, "COP"),
        sourceCurrency: "USD",
        destinationCurrency: "COP",
        rate: 0,
      }),
    ).toThrow(ValidationError);
  });

  it("rejects transfer with same source and destination account (TRA-1)", () => {
    expect(() =>
      transfer({ sourceAccountId: "a1", destinationAccountId: "a1" }),
    ).toThrow(ValidationError);
  });

  it("rejects transfer with zero or negative sourceAmount (Money VO enforces > 0)", () => {
    expect(() =>
      transfer({ sourceAmount: new Money(0, "COP"), destinationAmount: new Money(0, "COP") }),
    ).toThrow();
  });

  it("rejects transfer with empty ids", () => {
    expect(() => transfer({ id: "" })).toThrow(ValidationError);
    expect(() => transfer({ workspaceId: "" })).toThrow(ValidationError);
    expect(() => transfer({ sourceAccountId: "" })).toThrow(ValidationError);
    expect(() => transfer({ destinationAccountId: "" })).toThrow(ValidationError);
  });
});
