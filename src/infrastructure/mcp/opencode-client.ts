import { OPENCODE_CLIENT_ID } from "./config";

const CLIENT_METADATA_URL = new URL(OPENCODE_CLIENT_ID);
const MAX_METADATA_BYTES = 8_192;
const ALLOWED_REDIRECTS = [
  "http://127.0.0.1/callback",
  "http://localhost/callback",
  "http://127.0.0.1/mcp/oauth/callback",
];

export interface VerifiedMcpClient {
  clientId: string;
  clientName: string;
  clientUri: string;
  redirectUris: readonly string[];
}

/** The only remotely resolved client document is the hardcoded OpenCode CIMD URL. */
export async function getVerifiedOpenCodeClient(): Promise<VerifiedMcpClient> {
  const response = await fetch(CLIENT_METADATA_URL, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(3_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("OpenCode client metadata unavailable");

  const body = await readMetadataBody(response, MAX_METADATA_BYTES);
  if (body === null) {
    throw new Error("OpenCode client metadata is too large");
  }
  const metadata = JSON.parse(body) as Record<string, unknown>;
  const redirectUris = Array.isArray(metadata.redirect_uris)
    ? metadata.redirect_uris.filter((uri): uri is string => typeof uri === "string")
    : [];
  const grants = Array.isArray(metadata.grant_types) ? metadata.grant_types : [];
  const responses = Array.isArray(metadata.response_types) ? metadata.response_types : [];

  if (
    metadata.client_id !== OPENCODE_CLIENT_ID ||
    metadata.application_type !== "native" ||
    metadata.token_endpoint_auth_method !== "none" ||
    !grants.includes("authorization_code") ||
    !grants.includes("refresh_token") ||
    !responses.includes("code") ||
    !ALLOWED_REDIRECTS.every((uri) => redirectUris.includes(uri))
  ) {
    throw new Error("OpenCode client metadata did not match the approved profile");
  }

  return {
    clientId: OPENCODE_CLIENT_ID,
    clientName: "OpenCode",
    clientUri: "https://opencode.ai",
    redirectUris: ALLOWED_REDIRECTS,
  };
}

async function readMetadataBody(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Native loopback redirects may choose a dynamic local port. All other URI
 * components must exactly match the published and locally approved callback.
 */
export function isAllowedOpenCodeRedirect(redirectUri: string, client: VerifiedMcpClient): boolean {
  try {
    const candidate = new URL(redirectUri);
    if (
      candidate.protocol !== "http:" ||
      candidate.username ||
      candidate.password ||
      candidate.search ||
      candidate.hash
    ) {
      return false;
    }
    const base = `${candidate.protocol}//${candidate.hostname}${candidate.pathname}`;
    if (!client.redirectUris.includes(base)) return false;
    if (candidate.hostname === "localhost" && candidate.port && !validPort(candidate.port)) {
      return false;
    }
    if (candidate.hostname === "127.0.0.1" && candidate.port && !validPort(candidate.port)) {
      return false;
    }
    return candidate.hostname === "localhost" || candidate.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function validPort(port: string): boolean {
  const value = Number(port);
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}
