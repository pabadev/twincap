import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_URI = "mongodb://localhost:27017/globalmoney";
const VALID_SECRET = "x".repeat(32);

function setEnv(secret: string | undefined = VALID_SECRET): void {
  process.env.MONGODB_URI = VALID_URI;
  process.env.AUTH_SECRET = secret;
}

afterEach(() => {
  delete process.env.MONGODB_URI;
  delete process.env.AUTH_SECRET;
  vi.resetModules();
});

describe("parseEnv", () => {
  it("parses a valid environment", async () => {
    setEnv();
    const { parseEnv } = await import("./env");
    const parsed = parseEnv({ MONGODB_URI: VALID_URI, AUTH_SECRET: VALID_SECRET });
    expect(parsed.MONGODB_URI).toBe(VALID_URI);
    expect(parsed.AUTH_SECRET).toHaveLength(32);
  });

  it("fails fast when MONGODB_URI is missing", async () => {
    setEnv();
    const { parseEnv } = await import("./env");
    expect(() => parseEnv({ AUTH_SECRET: VALID_SECRET })).toThrow(/MONGODB_URI/);
  });

  it("fails fast when AUTH_SECRET is missing", async () => {
    setEnv();
    const { parseEnv } = await import("./env");
    expect(() => parseEnv({ MONGODB_URI: VALID_URI })).toThrow(/AUTH_SECRET/);
  });

  it("fails fast when AUTH_SECRET is shorter than 32 bytes", async () => {
    setEnv();
    const { parseEnv } = await import("./env");
    expect(() =>
      parseEnv({ MONGODB_URI: VALID_URI, AUTH_SECRET: "short" }),
    ).toThrow(/at least 32 bytes/);
  });

  it("fails fast at module load on invalid environment", async () => {
    setEnv("short");
    await expect(import("./env")).rejects.toThrow(/Invalid environment configuration/);
  });
});
