import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_URI = "mongodb://localhost:27017/twincap";
// 32 random bytes → base64url (43 chars)
const VALID_SECRET = Buffer.alloc(32, 0x42).toString("base64url");

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
    expect(parsed.AUTH_SECRET).toBe(VALID_SECRET);
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

  it("fails fast when AUTH_SECRET is not a valid base64url-encoded 32-byte key", async () => {
    setEnv();
    const { parseEnv } = await import("./env");
    expect(() =>
      parseEnv({ MONGODB_URI: VALID_URI, AUTH_SECRET: "short" }),
    ).toThrow(/base64url-encoded 32-byte key/);
  });

  it("fails fast on first env access with invalid environment", async () => {
    setEnv("short");
    const { getEnv } = await import("./env");
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });
});
