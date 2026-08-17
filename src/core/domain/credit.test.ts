import { describe, expect, it } from "vitest";
import { CreditGranted } from "./credit-granted";
import { CreditReceived } from "./credit-received";
import { ValidationError } from "./errors";
import { Money } from "./money";

const DATE = new Date("2026-01-01T00:00:00Z");

describe("CreditReceived entity", () => {
  it("creates with principal and no abonos → pending equals principal (CRED-R-2)", () => {
    const cr = new CreditReceived({
      id: "cr1",
      userId: "u1",
      counterparty: "Juan",
      principal: new Money(2_000_000, "COP"),
      accountId: "a1",
      date: DATE,
      createdAt: DATE,
    });
    expect(cr.pending).toBe(2_000_000);
  });

  it("computes pending = principal − Σ abonos (CRED-R-2)", () => {
    const cr = new CreditReceived(
      {
        id: "cr1",
        userId: "u1",
        counterparty: "Juan",
        principal: new Money(2_000_000, "COP"),
        accountId: "a1",
        date: DATE,
        createdAt: DATE,
      },
      [
        { id: "ab1", amount: new Money(500_000, "COP"), date: DATE, accountId: "a2" },
        { id: "ab2", amount: new Money(1_500_000, "COP"), date: DATE, accountId: "a2" },
      ],
    );
    expect(cr.pending).toBe(0);
  });

  it("rejects overpayment (CRED-R-2)", () => {
    expect(
      () =>
        new CreditReceived(
          {
            id: "cr1",
            userId: "u1",
            counterparty: "Juan",
            principal: new Money(500_000, "COP"),
            accountId: "a1",
            date: DATE,
            createdAt: DATE,
          },
          [{ id: "ab1", amount: new Money(600_000, "COP"), date: DATE, accountId: "a2" }],
        ),
    ).toThrow(ValidationError);
  });

  it("rejects abono with zero or negative amount (Money VO enforces > 0)", () => {
    expect(
      () =>
        new CreditReceived(
          {
            id: "cr1",
            userId: "u1",
            counterparty: "Juan",
            principal: new Money(500_000, "COP"),
            accountId: "a1",
            date: DATE,
            createdAt: DATE,
          },
          [{ id: "ab1", amount: new Money(0, "COP"), date: DATE, accountId: "a2" }],
        ),
    ).toThrow();
  });

  it("rejects abono with empty accountId", () => {
    expect(
      () =>
        new CreditReceived(
          {
            id: "cr1",
            userId: "u1",
            counterparty: "Juan",
            principal: new Money(500_000, "COP"),
            accountId: "a1",
            date: DATE,
            createdAt: DATE,
          },
          [{ id: "ab1", amount: new Money(100_000, "COP"), date: DATE, accountId: "" }],
        ),
    ).toThrow(ValidationError);
  });

  it("rejects zero or negative principal (Money VO enforces > 0)", () => {
    expect(
      () =>
        new CreditReceived({
          id: "cr1",
          userId: "u1",
          counterparty: "Juan",
          principal: new Money(0, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow();
  });

  it("trims counterparty and rejects empty", () => {
    const cr = new CreditReceived({
      id: "cr1",
      userId: "u1",
      counterparty: "  Juan  ",
      principal: new Money(1_000_000, "COP"),
      accountId: "a1",
      date: DATE,
      createdAt: DATE,
    });
    expect(cr.counterparty).toBe("Juan");

    expect(
      () =>
        new CreditReceived({
          id: "cr1",
          userId: "u1",
          counterparty: "   ",
          principal: new Money(1_000_000, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("rejects empty ids", () => {
    expect(
      () =>
        new CreditReceived({
          id: "",
          userId: "u1",
          counterparty: "Juan",
          principal: new Money(1_000_000, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
    expect(
      () =>
        new CreditReceived({
          id: "cr1",
          userId: "",
          counterparty: "Juan",
          principal: new Money(1_000_000, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
    expect(
      () =>
        new CreditReceived({
          id: "cr1",
          userId: "u1",
          counterparty: "Juan",
          principal: new Money(1_000_000, "COP"),
          accountId: "",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });
});

describe("CreditGranted entity", () => {
  it("creates with principal and no abonos → pending equals principal (CRED-G-2)", () => {
    const cg = new CreditGranted({
      id: "cg1",
      userId: "u1",
      counterparty: "María",
      principal: new Money(1_000_000, "COP"),
      accountId: "a1",
      date: DATE,
      createdAt: DATE,
    });
    expect(cg.pending).toBe(1_000_000);
  });

  it("computes pending = principal − Σ abonos (CRED-G-2)", () => {
    const cg = new CreditGranted(
      {
        id: "cg1",
        userId: "u1",
        counterparty: "María",
        principal: new Money(1_000_000, "COP"),
        accountId: "a1",
        date: DATE,
        createdAt: DATE,
      },
      [
        { id: "ab1", amount: new Money(400_000, "COP"), date: DATE, accountId: "a2" },
        { id: "ab2", amount: new Money(600_000, "COP"), date: DATE, accountId: "a2" },
      ],
    );
    expect(cg.pending).toBe(0);
  });

  it("rejects overpayment (CRED-G-2)", () => {
    expect(
      () =>
        new CreditGranted(
          {
            id: "cg1",
            userId: "u1",
            counterparty: "María",
            principal: new Money(600_000, "COP"),
            accountId: "a1",
            date: DATE,
            createdAt: DATE,
          },
          [{ id: "ab1", amount: new Money(700_000, "COP"), date: DATE, accountId: "a2" }],
        ),
    ).toThrow(ValidationError);
  });

  it("rejects abono with zero or negative amount (Money VO enforces > 0)", () => {
    expect(
      () =>
        new CreditGranted(
          {
            id: "cg1",
            userId: "u1",
            counterparty: "María",
            principal: new Money(600_000, "COP"),
            accountId: "a1",
            date: DATE,
            createdAt: DATE,
          },
          [{ id: "ab1", amount: new Money(0, "COP"), date: DATE, accountId: "a2" }],
        ),
    ).toThrow();
  });

  it("rejects zero or negative principal (Money VO enforces > 0)", () => {
    expect(
      () =>
        new CreditGranted({
          id: "cg1",
          userId: "u1",
          counterparty: "María",
          principal: new Money(0, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow();
  });

  it("trims counterparty and rejects empty", () => {
    const cg = new CreditGranted({
      id: "cg1",
      userId: "u1",
      counterparty: "  María  ",
      principal: new Money(1_000_000, "COP"),
      accountId: "a1",
      date: DATE,
      createdAt: DATE,
    });
    expect(cg.counterparty).toBe("María");

    expect(
      () =>
        new CreditGranted({
          id: "cg1",
          userId: "u1",
          counterparty: "   ",
          principal: new Money(1_000_000, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });

  it("rejects empty ids", () => {
    expect(
      () =>
        new CreditGranted({
          id: "",
          userId: "u1",
          counterparty: "María",
          principal: new Money(1_000_000, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
    expect(
      () =>
        new CreditGranted({
          id: "cg1",
          userId: "",
          counterparty: "María",
          principal: new Money(1_000_000, "COP"),
          accountId: "a1",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
    expect(
      () =>
        new CreditGranted({
          id: "cg1",
          userId: "u1",
          counterparty: "María",
          principal: new Money(1_000_000, "COP"),
          accountId: "",
          date: DATE,
          createdAt: DATE,
        }),
    ).toThrow(ValidationError);
  });
});
