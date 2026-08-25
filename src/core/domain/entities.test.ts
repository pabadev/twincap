import { describe, expect, it } from "vitest";
import { Account } from "./account";
import { Category } from "./category";
import { ValidationError } from "./errors";
import { User } from "./user";

const DATE = new Date("2026-01-01T00:00:00Z");
const userInput = { id: "u1", email: "user@example.com", passwordHash: "hash", createdAt: DATE };

describe("User", () => {
  it("normalizes email to lowercase trimmed form (AUTH-1)", () => {
    const user = new User({ ...userInput, email: "  User@Example.COM " });
    expect(user.email).toBe("user@example.com");
  });

  it("rejects malformed emails", () => {
    expect(() => new User({ ...userInput, email: "not-an-email" })).toThrow(ValidationError);
  });

  it("rejects empty ids and empty password hashes", () => {
    expect(() => new User({ ...userInput, id: "" })).toThrow(ValidationError);
    expect(() => new User({ ...userInput, passwordHash: "" })).toThrow(ValidationError);
  });
});

describe("Account", () => {
  it("has NO stored balance field — balance is derived from movements (design rev.2 §2)", () => {
    const account = new Account({
      id: "a1",
      userId: "u1",
      name: "Efectivo",
      currency: "COP",
      isFixed: true,
      createdAt: DATE,
    });
    expect(account).not.toHaveProperty("balance");
  });

  it("trims names and rejects empty ones", () => {
    const account = new Account({
      id: "a1",
      userId: "u1",
      name: "  BBVA  ",
      currency: "USD",
      isFixed: false,
      createdAt: DATE,
    });
    expect(account.name).toBe("BBVA");
    expect(() =>
      new Account({ id: "a2", userId: "u1", name: "   ", currency: "COP", isFixed: false, createdAt: DATE }),
    ).toThrow(ValidationError);
  });
});

describe("Category", () => {
  it("is type-scoped and rejects unknown types", () => {
    const income = new Category({ id: "c1", userId: "u1", name: "Salario", type: "income", createdAt: DATE });
    expect(income.type).toBe("income");
    expect(() =>
      new Category({ id: "c2", userId: "u1", name: "X", type: "savings" as never, createdAt: DATE }),
    ).toThrow(ValidationError);
  });
});
