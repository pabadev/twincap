import { describe, it, expect } from "vitest";
import { bcryptPasswordHasher } from "./password";

describe("bcryptPasswordHasher", () => {
  it("hashes a plain password", async () => {
    const hashed = await bcryptPasswordHasher.hash("mypassword");
    expect(hashed).not.toBe("mypassword");
    expect(hashed.length).toBeGreaterThan(0);
  });

  it("compares matching passwords", async () => {
    const hashed = await bcryptPasswordHasher.hash("secret123");
    const match = await bcryptPasswordHasher.compare("secret123", hashed);
    expect(match).toBe(true);
  });

  it("rejects non-matching passwords", async () => {
    const hashed = await bcryptPasswordHasher.hash("secret123");
    const match = await bcryptPasswordHasher.compare("wrong", hashed);
    expect(match).toBe(false);
  });
});
