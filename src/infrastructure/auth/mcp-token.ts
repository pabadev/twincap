import { createHash, randomBytes } from "node:crypto";

/** Generate a high-entropy opaque credential; callers must persist only digest. */
export function createMcpToken(): string {
  return `tc_mcp_${randomBytes(32).toString("base64url")}`;
}

/** SHA-256 is appropriate here because tokens are random, high-entropy secrets. */
export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
