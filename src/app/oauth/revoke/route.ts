import { connectDb } from "@/infrastructure/db/connection";
import { env } from "@/infrastructure/config/env";
import { OPENCODE_CLIENT_ID } from "@/infrastructure/mcp/config";
import { revokeToken } from "@/infrastructure/mcp/oauth-service";
import { readBoundedBody } from "@/infrastructure/mcp/read-bounded-body";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
  if (!env.MCP_ENABLED)
    return Response.json({ error: "temporarily_unavailable" }, { status: 503, headers });
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/x-www-form-urlencoded")
  )
    return Response.json({ error: "invalid_request" }, { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 8192)
    return Response.json({ error: "invalid_request" }, { status: 413, headers });
  const raw = await readBoundedBody(request, 8192);
  if (raw === null) return Response.json({ error: "invalid_request" }, { status: 413, headers });
  const form = new URLSearchParams(raw);
  const clientIds = form.getAll("client_id");
  const tokens = form.getAll("token");
  if (
    clientIds.length !== 1 ||
    clientIds[0] !== OPENCODE_CLIENT_ID ||
    tokens.length !== 1 ||
    !tokens[0]
  )
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  await connectDb();
  await revokeToken(tokens[0]);
  return new Response(null, { status: 200, headers });
}
