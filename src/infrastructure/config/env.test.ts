import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_URI = "mongodb://localhost:27017/twincap";
// 32 random bytes → base64url (43 chars)
const VALID_SECRET = Buffer.alloc(32, 0x42).toString("base64url");

const PROD_EMAIL_VARS = {
  RESEND_API_KEY: "re_test123",
  RESEND_FROM: "TwinCap <no-reply@test.com>",
  APP_BASE_URL: "https://app.test.com",
};

function baseEnv(extra?: Record<string, string | undefined>): Record<string, string | undefined> {
  return { MONGODB_URI: VALID_URI, AUTH_SECRET: VALID_SECRET, ...extra };
}

afterEach(() => {
  delete process.env.MONGODB_URI;
  delete process.env.AUTH_SECRET;
  vi.resetModules();
});

// ---------------------------------------------------------------------------
// parseEnv — basics
// ---------------------------------------------------------------------------
describe("parseEnv", () => {
  it("parses a valid environment", async () => {
    const { parseEnv } = await import("./env");
    const parsed = parseEnv(baseEnv());
    expect(parsed.MONGODB_URI).toBe(VALID_URI);
    expect(parsed.AUTH_SECRET).toBe(VALID_SECRET);
  });

  it("fails fast when MONGODB_URI is missing", async () => {
    const { parseEnv } = await import("./env");
    expect(() => parseEnv({ AUTH_SECRET: VALID_SECRET })).toThrow(/MONGODB_URI/);
  });

  it("fails fast when AUTH_SECRET is missing", async () => {
    const { parseEnv } = await import("./env");
    expect(() => parseEnv({ MONGODB_URI: VALID_URI })).toThrow(/AUTH_SECRET/);
  });

  it("fails fast when AUTH_SECRET is not a valid base64url-encoded 32-byte key", async () => {
    const { parseEnv } = await import("./env");
    expect(() => parseEnv(baseEnv({ AUTH_SECRET: "short" }))).toThrow(
      /base64url-encoded 32-byte key/,
    );
  });

  it("fails fast on first env access with invalid environment", async () => {
    const { getEnv } = await import("./env");
    // Override the test default so AUTH_SECRET is invalid
    process.env.MONGODB_URI = VALID_URI;
    process.env.AUTH_SECRET = "short";
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });
});

// ---------------------------------------------------------------------------
// parseEnv — optional fields accepted in non-production
// ---------------------------------------------------------------------------
describe("parseEnv — optional fields (non-production)", () => {
  it("accepts missing email vars without NODE_ENV", async () => {
    const { parseEnv } = await import("./env");
    const parsed = parseEnv(baseEnv());
    expect(parsed.RESEND_API_KEY).toBeUndefined();
    expect(parsed.RESEND_FROM).toBeUndefined();
    expect(parsed.APP_BASE_URL).toBeUndefined();
  });

  it("accepts missing email vars with NODE_ENV=development", async () => {
    const { parseEnv } = await import("./env");
    const parsed = parseEnv(baseEnv({ NODE_ENV: "development" }));
    expect(parsed.RESEND_API_KEY).toBeUndefined();
    expect(parsed.RESEND_FROM).toBeUndefined();
    expect(parsed.APP_BASE_URL).toBeUndefined();
  });

  it("accepts missing email vars with NODE_ENV=test", async () => {
    const { parseEnv } = await import("./env");
    const parsed = parseEnv(baseEnv({ NODE_ENV: "test" }));
    expect(parsed.RESEND_API_KEY).toBeUndefined();
    expect(parsed.RESEND_FROM).toBeUndefined();
    expect(parsed.APP_BASE_URL).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseEnv — production requires email + base URL vars (R14-E)
// ---------------------------------------------------------------------------
describe("parseEnv — production (R14-E)", () => {
  it("requires RESEND_API_KEY in production", async () => {
    const { parseEnv } = await import("./env");
    expect(() =>
      parseEnv(baseEnv({ NODE_ENV: "production", RESEND_FROM: "a@b.com", APP_BASE_URL: "https://a.com" })),
    ).toThrow(/RESEND_API_KEY/);
  });

  it("requires RESEND_FROM in production", async () => {
    const { parseEnv } = await import("./env");
    expect(() =>
      parseEnv(baseEnv({ NODE_ENV: "production", RESEND_API_KEY: "re_1", APP_BASE_URL: "https://a.com" })),
    ).toThrow(/RESEND_FROM/);
  });

  it("requires APP_BASE_URL in production", async () => {
    const { parseEnv } = await import("./env");
    expect(() =>
      parseEnv(baseEnv({ NODE_ENV: "production", RESEND_API_KEY: "re_1", RESEND_FROM: "a@b.com" })),
    ).toThrow(/APP_BASE_URL/);
  });

  it("rejects empty strings for required production vars", async () => {
    const { parseEnv } = await import("./env");
    expect(() =>
      parseEnv(
        baseEnv({
          NODE_ENV: "production",
          RESEND_API_KEY: "",
          RESEND_FROM: "",
          APP_BASE_URL: "",
        }),
      ),
    ).toThrow(/RESEND_API_KEY[\s\S]*RESEND_FROM[\s\S]*APP_BASE_URL/);
  });

  it("passes when all production vars are present", async () => {
    const { parseEnv } = await import("./env");
    const parsed = parseEnv(baseEnv({ NODE_ENV: "production", ...PROD_EMAIL_VARS }));
    expect(parsed.RESEND_API_KEY).toBe(PROD_EMAIL_VARS.RESEND_API_KEY);
    expect(parsed.RESEND_FROM).toBe(PROD_EMAIL_VARS.RESEND_FROM);
    expect(parsed.APP_BASE_URL).toBe(PROD_EMAIL_VARS.APP_BASE_URL);
    expect(parsed.NODE_ENV).toBe("production");
  });

  it("does not require error monitoring or analytics vars in production", async () => {
    const { parseEnv } = await import("./env");
    const parsed = parseEnv(baseEnv({ NODE_ENV: "production", ...PROD_EMAIL_VARS }));
    expect(parsed.ERROR_MONITORING_ENABLED).toBe(false);
    expect(parsed.ANALYTICS_ENABLED).toBe(false);
  });

  it("skips the email requirement during the next build phase (NEXT_PHASE=phase-production-build)", async () => {
    const { parseEnv } = await import("./env");
    // Local `pnpm build` prerenders pages that touch env without sending email.
    // The strict email requirement must not break that build.
    const parsed = parseEnv(
      baseEnv({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" }),
    );
    expect(parsed.RESEND_API_KEY).toBeUndefined();
    expect(parsed.APP_BASE_URL).toBeUndefined();
  });
});
