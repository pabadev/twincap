import { describe, expect, it } from "vitest";
import { Category } from "./category";
import { ValidationError } from "./errors";
import { Money } from "./money";
import {
  MOVEMENT_LINK_KINDS,
  Movement,
  assertCategoryMatchesMovement,
} from "./movement";

const DATE = new Date("2026-01-01T00:00:00Z");

function category(type: "income" | "expense"): Category {
  return new Category({ id: `cat-${type}`, workspaceId: "u1", name: `Cat ${type}`, type, createdAt: DATE });
}

function movement(
  overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {},
): Movement {
  return new Movement({
    id: "m1",
    workspaceId: "u1",
    accountId: "a1",
    category: category("expense"),
    type: "expense",
    amount: new Money(50_000, "COP"),
    date: DATE,
    context: "Personal",
    createdAt: DATE,
    ...overrides,
  });
}

describe("Movement entity", () => {
  it("signs the amount by type: income positive, expense negative (design rev.2 §2)", () => {
    const income = movement({ type: "income", category: category("income"), amount: new Money(100_000, "COP") });
    const expense = movement({ amount: new Money(80_000, "COP") });
    expect(income.signedAmount).toBe(100_000);
    expect(expense.signedAmount).toBe(-80_000);
  });

  it("rejects an income category on an expense movement (MOV-2)", () => {
    expect(() => movement({ category: category("income") })).toThrow(ValidationError);
  });

  it("rejects an expense category on an income movement (MOV-2)", () => {
    expect(() => movement({ type: "income", category: category("expense") })).toThrow(ValidationError);
  });

  it("exposes the MOV-2 rule standalone for use-case reuse", () => {
    expect(() => assertCategoryMatchesMovement(category("income"), "expense")).toThrow(ValidationError);
    expect(() => assertCategoryMatchesMovement(category("expense"), "expense")).not.toThrow();
  });

  it("stores the categoryId of the bound category", () => {
    expect(movement().categoryId).toBe("cat-expense");
  });

  it("rejects unknown movement types and unknown context values (MOV-1)", () => {
    expect(() => movement({ type: "transfer" as never })).toThrow(ValidationError);
    expect(() => movement({ context: "Work" as never })).toThrow(ValidationError);
  });

  it("accepts undefined context for system-linked movements (neutral)", () => {
    const neutral = movement({ context: undefined });
    expect(neutral.context).toBeUndefined();
  });

  it("accepts every system link kind and marks the movement as system-linked", () => {
    for (const kind of MOVEMENT_LINK_KINDS) {
      const linked = movement({ link: { kind, refId: "p1", opId: "op-1" } });
      expect(linked.link?.kind).toBe(kind);
      expect(linked.isSystemLinked()).toBe(true);
    }
  });

  it("rejects unknown link kinds (MOV-5)", () => {
    expect(() => movement({ link: { kind: "refund" as never, refId: "p1", opId: "op-1" } })).toThrow(
      ValidationError,
    );
  });

  it("rejects links without refId or opId", () => {
    expect(() => movement({ link: { kind: "transfer", refId: "", opId: "op-1" } })).toThrow(
      ValidationError,
    );
    expect(() => movement({ link: { kind: "transfer", refId: "p1", opId: "" } })).toThrow(
      ValidationError,
    );
  });

  it("marks manual movements as not system-linked (MOV-5)", () => {
    expect(movement().isSystemLinked()).toBe(false);
  });

  it("enforces amount > 0 through the Money value object (MOV-1)", () => {
    expect(() => movement({ amount: new Money(0, "COP") })).toThrow();
    expect(() => movement({ amount: new Money(-1, "COP") })).toThrow();
  });
});
