import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import { Money } from "./money";
import { computeLineItemSubtotal, Sale } from "./sale";

const DATE = new Date("2026-01-01T00:00:00Z");

function saleItem(overrides: { itemId?: string; quantity?: number; unitPrice?: Money } = {}) {
  return {
    itemId: overrides.itemId ?? "item-1",
    quantity: overrides.quantity ?? 2,
    unitPrice: overrides.unitPrice ?? new Money(50_000, "COP"),
  };
}

function sale(
  overrides: Partial<ConstructorParameters<typeof Sale>[0]> = {},
  abonos: ConstructorParameters<typeof Sale>[1] = [],
): Sale {
  return new Sale(
    {
      id: "s1",
      userId: "u1",
      items: [saleItem()],
      date: DATE,
      paymentMode: "paid-in-full",
      accountId: "a1",
      createdAt: DATE,
      ...overrides,
    },
    abonos,
  );
}

describe("Sale entity", () => {
  it("computes total as sum of quantity × unitPrice (POS-2)", () => {
    const s = sale();
    // 2 × 50,000 = 100,000
    expect(s.total).toBe(100_000);
  });

  it("computes total across multiple line items", () => {
    const s = sale({
      items: [
        { itemId: "i1", quantity: 2, unitPrice: new Money(50_000, "COP") },
        { itemId: "i2", quantity: 1, unitPrice: new Money(30_000, "COP") },
      ],
    });
    // 100,000 + 30,000 = 130,000
    expect(s.total).toBe(130_000);
  });

  it("computes pending = total − Σ abonos (POS-5)", () => {
    const s = sale(
      { items: [saleItem({ quantity: 2, unitPrice: new Money(50_000, "COP") })] },
      [{ id: "ab1", amount: new Money(30_000, "COP"), date: DATE, accountId: "a1" }],
    );
    expect(s.pending).toBe(70_000);
  });

  it("pending is 0 when fully paid", () => {
    const s = sale(
      {},
      [{ id: "ab1", amount: new Money(100_000, "COP"), date: DATE, accountId: "a1" }],
    );
    expect(s.pending).toBe(0);
  });

  it("rejects sale with no line items (POS-2)", () => {
    expect(() => sale({ items: [] })).toThrow(ValidationError);
  });

  it("rejects line item with quantity <= 0", () => {
    expect(() =>
      sale({ items: [{ itemId: "i1", quantity: 0, unitPrice: new Money(50_000, "COP") }] }),
    ).toThrow(ValidationError);
    expect(() =>
      sale({ items: [{ itemId: "i1", quantity: -1, unitPrice: new Money(50_000, "COP") }] }),
    ).toThrow(ValidationError);
  });

  it("rejects line item with zero unitPrice (Money VO enforces > 0)", () => {
    expect(() =>
      sale({ items: [{ itemId: "i1", quantity: 1, unitPrice: new Money(0, "COP") }] }),
    ).toThrow();
  });

  it("rejects line item with empty itemId", () => {
    expect(() =>
      sale({ items: [{ itemId: "", quantity: 1, unitPrice: new Money(50_000, "COP") }] }),
    ).toThrow(ValidationError);
  });

  it("rejects overpayment (POS-5)", () => {
    expect(() =>
      sale(
        { items: [saleItem({ quantity: 1, unitPrice: new Money(50_000, "COP") })] },
        [{ id: "ab1", amount: new Money(60_000, "COP"), date: DATE, accountId: "a1" }],
      ),
    ).toThrow(ValidationError);
  });

  it("rejects abono with zero or negative amount (Money VO enforces > 0)", () => {
    expect(() =>
      sale(
        {},
        [{ id: "ab1", amount: new Money(0, "COP"), date: DATE, accountId: "a1" }],
      ),
    ).toThrow();
  });

  it("rejects unknown payment mode", () => {
    expect(() =>
      sale({ paymentMode: "installment" as never }),
    ).toThrow(ValidationError);
  });

  it("rejects empty ids", () => {
    expect(() => sale({ id: "" })).toThrow(ValidationError);
    expect(() => sale({ userId: "" })).toThrow(ValidationError);
    expect(() => sale({ accountId: "" })).toThrow(ValidationError);
  });
});

describe("computeLineItemSubtotal", () => {
  it("multiplies quantity by unitPrice amount", () => {
    expect(computeLineItemSubtotal(3, new Money(10_000, "COP"))).toBe(30_000);
  });
});
