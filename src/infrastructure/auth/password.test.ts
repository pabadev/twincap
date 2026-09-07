import { describe, it, expect } from "vitest";
import { bcryptPasswordHasher } from "./password";

describe("bcryptPasswordHasher", () => {
  // bcrypt is CPU-bound; under full-suite parallel load a single hash can
  // exceed Vitest's 5s default (observed flaky timeout R14-N). Give the
  // block room proportional to the real cost of 5 hash/compare rounds.
  const BCRYPT_TIMEOUT = 20_000;

  it("hashes a plain password", async () => {
    const hashed = await bcryptPasswordHasher.hash("mypassword");
    expect(hashed).not.toBe("mypassword");
    expect(hashed.length).toBeGreaterThan(0);
  }, BCRYPT_TIMEOUT);

  it("compares matching passwords", async () => {
    const hashed = await bcryptPasswordHasher.hash("secret123");
    const match = await bcryptPasswordHasher.compare("secret123", hashed);
    expect(match).toBe(true);
  }, BCRYPT_TIMEOUT);

  it("rejects non-matching passwords", async () => {
    const hashed = await bcryptPasswordHasher.hash("secret123");
    const match = await bcryptPasswordHasher.compare("wrong", hashed);
    expect(match).toBe(false);
  }, BCRYPT_TIMEOUT);
});
