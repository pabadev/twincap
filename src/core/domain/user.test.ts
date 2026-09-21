import { describe, it, expect } from "vitest";
import { User } from "./user";
import type { Currency } from "./currency";

describe("User", () => {
  const baseInput = {
    id: "user-123",
    email: "test@example.com",
    passwordHash: "hash123",
    createdAt: new Date("2024-01-01"),
  };

  it("creates a user without defaultCurrency", () => {
    const user = new User(baseInput);
    expect(user.defaultCurrency).toBeUndefined();
  });

  it("creates a user with defaultCurrency USD", () => {
    const user = new User({ ...baseInput, defaultCurrency: "USD" as Currency });
    expect(user.defaultCurrency).toBe("USD");
  });

  it("creates a user with defaultCurrency BRL (if supported)", () => {
    // Note: BRL is not in the supported CURRENCIES list, but the domain accepts it
    // The validation happens at the server action level
    const user = new User({ ...baseInput, defaultCurrency: "BRL" as Currency });
    expect(user.defaultCurrency).toBe("BRL");
  });

  it("serializes defaultCurrency in toJSON", () => {
    const user = new User({ ...baseInput, defaultCurrency: "EUR" as Currency });
    const json = user.toJSON();
    expect(json.defaultCurrency).toBe("EUR");
  });

  it("serializes undefined defaultCurrency in toJSON", () => {
    const user = new User(baseInput);
    const json = user.toJSON();
    expect(json.defaultCurrency).toBeUndefined();
  });
});
