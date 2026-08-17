import { describe, it, expect } from "vitest";
import { EncryptJWT } from "jose";

// Set env BEFORE any module import that triggers parseEnv
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.AUTH_SECRET = "x".repeat(32);

// Dynamic import after env is set
const { joseSessionManager } = await import("./session");

describe("joseSessionManager", () => {
  it("creates a verifiable JWE token", async () => {
    const token = await joseSessionManager.create("user-123");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const payload = await joseSessionManager.verify(token);
    expect(payload).toEqual({ sub: "user-123" });
  });

  it("returns null for invalid tokens", async () => {
    const result = await joseSessionManager.verify("invalid.token.here");
    expect(result).toBeNull();
  });

  it("returns null for tokens signed with a different key", async () => {
    const otherSecret = new TextEncoder().encode("y".repeat(32));
    const token = await new EncryptJWT({ sub: "user-999" })
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .encrypt(otherSecret);

    const result = await joseSessionManager.verify(token);
    expect(result).toBeNull();
  });
});
