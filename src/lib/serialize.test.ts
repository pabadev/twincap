import { describe, expect, it } from "vitest";
import { serializeEntities, serializeEntity } from "./serialize";
import { CreditReceived } from "../core/domain/credit-received";
import type { CreditAbono } from "../core/domain/credit-received";
import { Account } from "../core/domain/account";
import { Money } from "../core/domain/money";

const date = new Date("2026-01-15T12:00:00.000Z");

const abonos: CreditAbono[] = [
  {
    id: "abono-1",
    amount: new Money(4_000_000, "COP"),
    date,
    accountId: "acc-1",
  },
];

function makeCredit(): CreditReceived {
  return new CreditReceived(
    {
      id: "credit-1",
      userId: "user-1",
      counterparty: "Lender",
      principal: new Money(10_000_000, "COP"),
      accountId: "acc-1",
      date,
      frequency: "monthly",
      createdAt: date,
    },
    abonos,
  );
}

describe("serializeEntity", () => {
  it("returns a plain snapshot of a single entity", () => {
    const account = new Account({
      id: "acc-1",
      userId: "user-1",
      name: "Efectivo",
      currency: "COP",
      isFixed: true,
      createdAt: date,
    });

    const result = serializeEntity(account);

    expect(result).toEqual({
      id: "acc-1",
      userId: "user-1",
      name: "Efectivo",
      currency: "COP",
      isFixed: true,
      scope: "Personal",
      createdAt: date,
    });
  });

  it("preserves toJSON-derived fields as own values", () => {
    const credit = makeCredit();

    const result = serializeEntity(credit);

    // `pending` lives on the prototype; structuredClone would strip it.
    expect(result.pending).toBe(6_000_000);
    expect(result.abonos).toHaveLength(1);
    expect(result.abonos[0].id).toBe("abono-1");
  });

  it("does not choke on nested Money value objects", () => {
    const result = serializeEntity(makeCredit());

    expect(result.principal.amount).toBe(10_000_000);
    expect(result.principal.currency).toBe("COP");
    expect(result.abonos[0].amount.amount).toBe(4_000_000);
    expect(result.abonos[0].amount.currency).toBe("COP");
  });
});

describe("serializeEntities", () => {
  it("serializes every entity in the array preserving order", () => {
    const accounts = [
      new Account({
        id: "acc-1",
        userId: "user-1",
        name: "Efectivo",
        currency: "COP",
        isFixed: true,
        createdAt: date,
      }),
      new Account({
        id: "acc-2",
        userId: "user-1",
        name: "Nequi",
        currency: "COP",
        isFixed: true,
        createdAt: date,
      }),
    ];

    const result = serializeEntities(accounts);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(["acc-1", "acc-2"]);
    expect(result[1].name).toBe("Nequi");
  });

  it("resolves derived fields for every credit in the array", () => {
    const credits = [makeCredit(), makeCredit()];

    const result = serializeEntities(credits);

    expect(result.every((credit) => credit.pending === 6_000_000)).toBe(true);
    expect(result.every((credit) => credit.abonos.length === 1)).toBe(true);
  });

  it("returns an empty array for an empty input", () => {
    expect(serializeEntities([])).toEqual([]);
  });
});
