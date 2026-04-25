import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DbManager } from "./db.js";
import { registerAllLocalTools } from "./tools/index.js";
import { RemoteClient } from "./remote/client.js";
import { registerRemoteTools } from "./remote/tools.js";
import { registerMethodologyTools } from "./remote/methodology-tools.js";

const PROXY_VERSION = "0.2.0";

const DD_DIR = process.env.DD_DIR;
if (!DD_DIR) {
  console.error("[dd-manager-proxy] FATAL: DD_DIR environment variable is required.");
  process.exit(1);
}

// =============================================
// License key validation (BEFORE we open stdio).
// Three failure modes — each prints a clear, actionable message.
// =============================================

const rawLicenseKey = process.env.DANCYCODES_LICENSE_KEY ?? "";

// Mode 1: NOT SET. Either truly empty, or the literal placeholder string
// — which means Claude Code's user_config substitution didn't fire.
if (!rawLicenseKey || rawLicenseKey.includes("${user_config")) {
  console.error("[dd-manager-proxy] FATAL: DANCYCODES_LICENSE_KEY is not set.");
  console.error("[dd-manager-proxy] This usually means the plugin's user config wasn't completed during install.");
  console.error("[dd-manager-proxy]");
  console.error("[dd-manager-proxy] Fix in 2 steps:");
  console.error("[dd-manager-proxy]   1. Get a free beta license: email dancycodes@gmail.com");
  console.error("[dd-manager-proxy]   2. In Claude Code, run:  /plugin config dancycodes-pro-marketplace/dancycodes-pro");
  console.error("[dd-manager-proxy]      (Or restart and re-install: /plugin install dancycodes-pro)");
  console.error("[dd-manager-proxy]");
  console.error("[dd-manager-proxy] After setting the key, restart Claude Code (close + reopen) so the MCP picks up the new env.");
  process.exit(1);
}

// Mode 2: MALFORMED. Quick local sanity check before pinging the engine.
const KEY_FORMAT = /^DCP-[A-Z0-9]{6,}-[A-Z0-9]{12,}$/;
if (!KEY_FORMAT.test(rawLicenseKey)) {
  const preview = rawLicenseKey.length > 20 ? rawLicenseKey.substring(0, 16) + "..." : rawLicenseKey;
  console.error(`[dd-manager-proxy] FATAL: license key looks malformed: "${preview}"`);
  console.error("[dd-manager-proxy] Expected format: DCP-XXXXXXXX-XXXXXXXXXXXXXXXX");
  console.error("[dd-manager-proxy] Update via: /plugin config dancycodes-pro-marketplace/dancycodes-pro");
  process.exit(1);
}

// Mode 3 check happens after we instantiate the RemoteClient and call
// checkLicenseHealth() — the engine is the authoritative source.

// =============================================
// Set up DB + MCP server
// =============================================

const dm = new DbManager(DD_DIR);

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
  version: PROXY_VERSION,
});

registerAllLocalTools(server, dm);

// =============================================
// Validate license against engine, then register remote tools
// =============================================

async function main(): Promise<void> {
  const remoteClient = new RemoteClient();

  // Mode 3: ENGINE REJECTS THE KEY.
  const health = await remoteClient.checkLicenseHealth();
  if (!health.ok) {
    console.error(`[dd-manager-proxy] FATAL: license check failed — ${health.reason}`);
    console.error("[dd-manager-proxy] Update via: /plugin config dancycodes-pro-marketplace/dancycodes-pro");
    console.error("[dd-manager-proxy] Or contact dancycodes@gmail.com if your key was revoked unexpectedly.");
    process.exit(1);
  }

  console.error(
    `[dd-manager-proxy] License OK (${health.plan} plan, ${health.email}). Proxy v${PROXY_VERSION}.`,
  );

  // Engine version sanity check (non-fatal — just warn).
  const meta = await remoteClient.getEngineMeta();
  if (meta.ok && meta.min_proxy_version && compareVersions(PROXY_VERSION, meta.min_proxy_version) < 0) {
    console.error(
      `[dd-manager-proxy] WARN: engine ${meta.version} requires proxy >= ${meta.min_proxy_version}, you have ${PROXY_VERSION}.`,
    );
    console.error(
      "[dd-manager-proxy] WARN: refresh with: npm cache clean --force  then restart Claude Code.",
    );
  }

  // Register remote tools (proprietary algorithms + methodology forwarders).
  registerRemoteTools(server, dm, remoteClient);
  registerMethodologyTools(server, remoteClient);
  console.error(
    "[dd-manager-proxy] Remote tools registered (engine:",
    process.env.DANCYCODES_ENGINE_URL ?? "default URL",
    ")",
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[dd-manager-proxy] Connected via stdio. Ready.");
}

/** Compare semver-ish versions A vs B. Returns -1 if A < B, 0 if equal, 1 if A > B. */
function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map((n) => parseInt(n, 10) || 0);
  const bParts = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

main().catch((err) => {
  console.error("[dd-manager-proxy] Fatal error:", err);
  process.exit(1);
});
