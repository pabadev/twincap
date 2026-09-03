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

  it("stores optional name (trimmed) and locale", () => {
    const user = new User({ ...userInput, name: "  Juan  ", locale: "es" });
    expect(user.name).toBe("Juan");
    expect(user.locale).toBe("es");
  });

  it("treats empty name as undefined (backward compat)", () => {
    const user = new User({ ...userInput, name: "" });
    expect(user.name).toBeUndefined();
  });

  it("works without name and locale (backward compat for existing users)", () => {
    const user = new User(userInput);
    expect(user.name).toBeUndefined();
    expect(user.locale).toBeUndefined();
  });

  it("toJSON includes all fields", () => {
    const user = new User({ ...userInput, name: "Ana", locale: "en", emailVerified: true });
    const json = user.toJSON();
    expect(json).toEqual({
      id: "u1",
      email: "user@example.com",
      name: "Ana",
      locale: "en",
      createdAt: DATE,
      emailVerified: true,
    });
  });

  it("toJSON has undefined name/locale when not provided", () => {
    const user = new User(userInput);
    const json = user.toJSON();
    expect(json.name).toBeUndefined();
    expect(json.locale).toBeUndefined();
  });

  it("toJSON normalizes emailVerified to boolean (undefined === false)", () => {
    const json = new User(userInput).toJSON();
    expect(json.emailVerified).toBe(false);
    const verified = new User({ ...userInput, emailVerified: true }).toJSON();
    expect(verified.emailVerified).toBe(true);
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
