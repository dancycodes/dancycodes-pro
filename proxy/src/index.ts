import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DbManager } from "./db.js";
import { registerAllLocalTools } from "./tools/index.js";
import { RemoteClient } from "./remote/client.js";
import { registerRemoteTools } from "./remote/tools.js";
import { registerMethodologyTools } from "./remote/methodology-tools.js";

const DD_DIR = process.env.DD_DIR;
if (!DD_DIR) {
  console.error("[dd-manager-proxy] FATAL: DD_DIR environment variable is required.");
  process.exit(1);
}

const dm = new DbManager(DD_DIR);

// Cleanup on exit
process.on("exit", () => dm.close());
process.on("SIGINT", () => {
  dm.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  dm.close();
  process.exit(0);
});

const server = new McpServer({
  name: "dd-manager-proxy",
  version: "0.1.0",
});

// Register all ~30 local CRUD tools (project, features, tasks, errors/conventions,
// reviews, qa, bugs, fixes, config, sprint-contracts, evaluations, module-qa).
registerAllLocalTools(server, dm);

// Register the 8 remote-forwarded tools (next_task, recover, compute_sort_order,
// propose_feature, propose_qa_spec, qa_recover, next_qa_task, next_fix_task).
// These forward local state to the DancyCodes engine for proprietary-algorithm processing.
try {
  const remoteClient = new RemoteClient();
  registerRemoteTools(server, dm, remoteClient);
  registerMethodologyTools(server, remoteClient);
  console.error(
    "[dd-manager-proxy] Remote tools registered (engine:",
    process.env.DANCYCODES_ENGINE_URL ?? "default URL",
    ")",
  );
} catch (e) {
  console.error("[dd-manager-proxy] Remote tools NOT registered:", (e as Error).message);
  console.error(
    "[dd-manager-proxy] Set DANCYCODES_LICENSE_KEY env var to enable remote tools.",
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[dd-manager-proxy] Connected via stdio (local CRUD tools ready)");
}

main().catch((err) => {
  console.error("[dd-manager-proxy] Fatal error:", err);
  process.exit(1);
});
