import { env } from "@/infrastructure/config/env";

export const OPENCODE_CLIENT_ID = "https://opencode.ai/oauth/opencode/client.json";
export const MCP_CAPABILITY = "personal.summary:read" as const;
export const MCP_MOVEMENTS_CAPABILITY = "personal.movements:read" as const;

/** Capability scopes a pilot grant may carry — the consent screen governs beyond the first. */
export const ALLOWED_MCP_CAPABILITIES: readonly string[] = [
  MCP_CAPABILITY,
  MCP_MOVEMENTS_CAPABILITY,
];

/** Capability markers checked tool-side: read capabilities per tool family. */
export const MCP_RESOURCE_PATH = "/api/mcp";

export function isMcpEnabledForUser(userId: string): boolean {
  if (!env.MCP_ENABLED) return false;
  const allowedIds = (env.MCP_PILOT_USER_IDS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowedIds.includes(userId.toLowerCase());
}

export function getMcpIssuer(): URL {
  const configured = env.APP_BASE_URL;
  if (!configured) throw new Error("APP_BASE_URL is required for MCP OAuth");
  const issuer = new URL(configured);
  if (issuer.username || issuer.password || issuer.search || issuer.hash) {
    throw new Error("APP_BASE_URL must be a canonical origin");
  }
  if (issuer.pathname !== "/" && issuer.pathname !== "") {
    throw new Error("APP_BASE_URL must not contain a path for MCP OAuth");
  }
  if (env.NODE_ENV === "production" && issuer.protocol !== "https:") {
    throw new Error("MCP OAuth requires HTTPS in production");
  }
  if (
    env.NODE_ENV !== "production" &&
    issuer.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(issuer.hostname)
  ) {
    throw new Error("MCP OAuth only allows HTTP on localhost during development");
  }
  issuer.pathname = "";
  return issuer;
}

export function getMcpResource(): URL {
  return new URL(MCP_RESOURCE_PATH, getMcpIssuer());
}

export function isAllowedMcpHost(request: Request): boolean {
  const expectedHost = getMcpIssuer().host.toLowerCase();
  const requestHost = request.headers.get("host")?.toLowerCase();
  return requestHost === expectedHost;
}

export function isAllowedMcpOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.origin === getMcpIssuer().origin) return true;
    return (
      env.NODE_ENV !== "production" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}
