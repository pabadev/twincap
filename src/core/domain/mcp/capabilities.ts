/**
 * TwinCap capabilities that may be granted to an MCP client.
 *
 * These are authorization identifiers, not role names. The initial release
 * deliberately contains only Personal read capabilities; business and write
 * access must be added through an explicitly approved scope and policy.
 */
export const MCP_CAPABILITIES = [
  "personal.summary:read",
  "personal.movements:read",
  "personal.accounts:read",
  "personal.credits:read",
  "personal.payables:read",
] as const;

export type McpCapability = (typeof MCP_CAPABILITIES)[number];

export interface McpPrincipal {
  userId: string;
  grantId: string;
  clientId: string;
  capabilities: readonly McpCapability[];
  personalWorkspaceId: string;
}

/** Deny by default; never accept identity or scope from MCP tool arguments. */
export function hasMcpCapability(principal: McpPrincipal, capability: McpCapability): boolean {
  return principal.capabilities.includes(capability);
}
