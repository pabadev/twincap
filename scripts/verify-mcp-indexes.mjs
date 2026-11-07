/** Read-only check of the MCP production index contract. */
process.argv.push("--verify");
await import("./ensure-mcp-indexes.mjs");
