#!/usr/bin/env node
// Entry point for the dd-manager-proxy MCP server.
// This script is invoked by Claude Code via .mcp.json.
import('../build/index.js').catch((err) => {
  console.error('[dd-manager-proxy] Failed to start:', err);
  process.exit(1);
});
