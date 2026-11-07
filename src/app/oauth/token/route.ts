import { connectDb } from "@/infrastructure/db/connection";
import { env } from "@/infrastructure/config/env";
import { getMcpResource, MCP_CAPABILITY, OPENCODE_CLIENT_ID } from "@/infrastructure/mcp/config";
import { exchangeAuthorizationCode, rotateRefreshToken } from "@/infrastructure/mcp/oauth-service";
import { readBoundedBody } from "@/infrastructure/mcp/read-bounded-body";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
function error(code: string, status = 400) {
  return Response.json({ error: code }, { status, headers });
}
export async function POST(request: Request) {
  if (!env.MCP_ENABLED) return error("temporarily_unavailable", 503);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/x-www-form-urlencoded")
  )
    return error("invalid_request", 415);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 8192) return error("invalid_request", 413);
  const raw = await readBoundedBody(request, 8192);
  if (raw === null) return error("invalid_request", 413);
  const form = new URLSearchParams(raw);
  const get = (key: string) => {
    const all = form.getAll(key);
    return all.length === 1 ? all[0] : null;
  };
  if (
    get("client_id") !== OPENCODE_CLIENT_ID ||
    (get("resource") && get("resource") !== getMcpResource().toString())
  )
    return error("invalid_client");
  try {
    await connectDb();
    const grantType = get("grant_type");
    const result =
      grantType === "authorization_code"
        ? await exchangeAuthorizationCode({
            code: get("code") ?? "",
            clientId: OPENCODE_CLIENT_ID,
            redirectUri: get("redirect_uri") ?? "",
            codeVerifier: get("code_verifier") ?? "",
            resource: getMcpResource().toString(),
          })
        : grantType === "refresh_token"
          ? await rotateRefreshToken({
              refreshToken: get("refresh_token") ?? "",
              clientId: OPENCODE_CLIENT_ID,
              resource: getMcpResource().toString(),
            })
          : null;
    return result
      ? Response.json(result, { headers })
      : error(
          grantType === "authorization_code" || grantType === "refresh_token"
            ? "invalid_grant"
            : "unsupported_grant_type",
        );
  } catch (cause) {
    // Keep OAuth clients' error parsing standards-compliant. Never log form
    // values here: they include authorization codes and bearer credentials.
    console.error("MCP OAuth token endpoint failed", {
      errorName: cause instanceof Error ? cause.name : "UnknownError",
      errorMessage:
        cause instanceof Error
          ? cause.message
              .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted MongoDB URI]")
              .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
              .slice(0, 300)
          : "Unexpected non-error exception",
    });
    return error("server_error", 500);
  }
}
