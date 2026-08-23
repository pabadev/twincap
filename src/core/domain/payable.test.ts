import { describe, expect, it } from "vitest";
import { Payable } from "./payable";
import { Money, MoneyError } from "./money";
import { ValidationError } from "./errors";

function makePayable(
  overrides: Partial<ConstructorParameters<typeof Payable>[0]> = {},
  abonos: ConstructorParameters<typeof Payable>[1] = [],
): Payable {
  return new Payable(
    {
      id: "pay-1",
      userId: "user-1",
      counterparty: "Proveedor SA",
      total: new Money(100000, "COP"),
      initialPayment: 0,
      accountId: "acc-1",
      date: new Date("2025-06-01"),
      createdAt: new Date(),
      ...overrides,
    },
    abonos,
  );
}

describe("Payable", () => {
  it("creates with defaults and derives pending (PAY-R-2)", () => {
    const payable = makePayable();
    expect(payable.pending).toBe(100000);
    expect(payable.abonos).toHaveLength(0);

    const paid = makePayable({ initialPayment: 30000 });
    expect(paid.pending).toBe(70000);
  });

  it("derives pending = total − initialPayment − Σ abonos", () => {
    const payable = makePayable({ initialPayment: 20000 }, [
      { id: "ab-1", amount: new Money(30000, "COP"), date: new Date(), accountId: "acc-1" },
      { id: "ab-2", amount: new Money(10000, "COP"), date: new Date(), accountId: "acc-1" },
    ]);
    expect(payable.pending).toBe(40000);
  });

  it("allows pending to reach exactly 0 (fully paid)", () => {
    const payable = makePayable({ initialPayment: 40000 }, [
      { id: "ab-1", amount: new Money(60000, "COP"), date: new Date(), accountId: "acc-1" },
    ]);
    expect(payable.pending).toBe(0);
  });

  it("rejects empty id / userId / counterparty / accountId", () => {
    expect(() => makePayable({ id: "" })).toThrow(ValidationError);
    expect(() => makePayable({ userId: "" })).toThrow(ValidationError);
    expect(() => makePayable({ counterparty: "   " })).toThrow(ValidationError);
    expect(() => makePayable({ accountId: "" })).toThrow(ValidationError);
  });

  it("rejects non-positive total via strict Money", () => {
    expect(() => makePayable({ total: new Money(0, "COP") })).toThrow(MoneyError);
  });

  it("rejects negative or non-integer initialPayment", () => {
    expect(() => makePayable({ initialPayment: -1 })).toThrow(ValidationError);
    expect(() => makePayable({ initialPayment: 10.5 })).toThrow(ValidationError);
  });

  it("rejects initialPayment greater than total", () => {
    expect(() => makePayable({ initialPayment: 100001 })).toThrow(ValidationError);
  });

  it("rejects overpayment via abonos (initialPayment + Σ abonos > total)", () => {
    expect(() =>
      makePayable({ initialPayment: 50000 }, [
        { id: "ab-1", amount: new Money(60000, "COP"), date: new Date(), accountId: "acc-1" },
      ]),
    ).toThrow(ValidationError);
    expect(() =>
      makePayable({}, [
        { id: "ab-1", amount: new Money(100000, "COP"), date: new Date(), accountId: "acc-1" },
      ]),
    ).not.toThrow();
  });

  it("toJSON returns a plain serializable snapshot", () => {
    const payable = makePayable(
      { dueDate: new Date("2025-07-15"), note: "Compra de perfume" },
      [{ id: "ab-1", amount: new Money(25000, "COP"), date: new Date(), accountId: "acc-1", movementId: "mov-1" }],
    );
    const json = payable.toJSON();

    expect(json.id).toBe("pay-1");
    expect(json.total).toEqual({ amount: 100000, currency: "COP" });
    expect(json.initialPayment).toBe(0);
    expect(json.dueDate).toEqual(new Date("2025-07-15"));
    expect(json.note).toBe("Compra de perfume");
    expect(json.pending).toBe(75000);
    expect(json.abonos[0].amount).toEqual({ amount: 25000, currency: "COP" });
    // No class prototypes leak through the boundary
    expect(Object.getPrototypeOf(json)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(json.total)).toBe(Object.prototype);
  });
});
