import {
  getMcpIssuer,
  getMcpResource,
  MCP_CAPABILITY,
  MCP_MOVEMENTS_CAPABILITY,
} from "@/infrastructure/mcp/config";
export const dynamic = "force-dynamic";
export async function GET() {
  const resource = getMcpResource();
  return Response.json(
    {
      resource: resource.toString(),
      authorization_servers: [getMcpIssuer().origin],
      bearer_methods_supported: ["header"],
      scopes_supported: [MCP_CAPABILITY, MCP_MOVEMENTS_CAPABILITY],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
