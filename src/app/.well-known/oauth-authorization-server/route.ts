import { getMcpIssuer, getMcpResource, MCP_CAPABILITY } from "@/infrastructure/mcp/config";
export const dynamic = "force-dynamic";
export async function GET() {
  const issuer = getMcpIssuer();
  return Response.json(
    {
      issuer: issuer.origin,
      authorization_endpoint: new URL("/oauth/authorize", issuer),
      token_endpoint: new URL("/oauth/token", issuer),
      revocation_endpoint: new URL("/oauth/revoke", issuer),
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [MCP_CAPABILITY],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      resource_parameter_supported: true,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
