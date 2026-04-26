import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DbManager } from "./db.js";
import { registerAllLocalTools } from "./tools/index.js";
import { RemoteClient } from "./remote/client.js";
import { registerRemoteTools } from "./remote/tools.js";
import { registerMethodologyTools } from "./remote/methodology-tools.js";
import { getMachineIdentity, fingerprintShort } from "./license/fingerprint.js";

const PROXY_VERSION = "0.3.0";

// DD_DIR is the directory under the project root where SQLite + recovery files
// live. The Claude Code plugin's .mcp.json sets this to ".executor". If we
// were spawned outside the plugin (or the plugin's env-block wasn't applied —
// which can happen after `cd`-ing into a freshly-generated project workspace),
// fall back to the standard ".executor" instead of failing fatally.
const DD_DIR = process.env.DD_DIR && process.env.DD_DIR.length > 0
  ? process.env.DD_DIR
  : ".executor";
if (!process.env.DD_DIR) {
  console.error(
    "[dd-manager-proxy] DD_DIR not set — defaulting to '.executor'. " +
      "(Set DD_DIR explicitly if you need a different folder.)",
  );
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
  console.error("[dd-manager-proxy]");
  console.error("[dd-manager-proxy] This commonly happens in two situations:");
  console.error("[dd-manager-proxy]   (a) First-time install — the plugin's user_config prompt was skipped/dismissed.");
  console.error("[dd-manager-proxy]   (b) AFTER Phase 3 finishes and you cd into the new project directory and start");
  console.error("[dd-manager-proxy]       implementation. Claude Code respawns this MCP in the new workspace and");
  console.error("[dd-manager-proxy]       the user_config sometimes does not propagate to the new spawn.");
  console.error("[dd-manager-proxy]");
  console.error("[dd-manager-proxy] Fix (works in both cases):");
  console.error("[dd-manager-proxy]   1. In Claude Code, run:  /plugin config dancycodes-pro-marketplace/dancycodes-pro");
  console.error("[dd-manager-proxy]      Paste your DCP-XXXXXXXX-XXXXXXXXXXXXXXXX key.");
  console.error("[dd-manager-proxy]   2. Close Claude Code and reopen it (so the MCP picks up the new env).");
  console.error("[dd-manager-proxy]");
  console.error("[dd-manager-proxy] No key yet? Email dancycodes@gmail.com for a free beta license.");
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

  // Mode 3: ENGINE REJECTS THE KEY (license existence/expiry/revoke check).
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

  // ============================================================
  // v0.3.0: Machine fingerprint binding.
  // Every license — free admin-issued or paid Pro — is bound to ONE machine.
  // 2 self-service swaps per rolling 30 days, then admin-terminal unblock required.
  // ============================================================
  const identity = getMachineIdentity();
  console.error(
    `[dd-manager-proxy] Machine identity: ${identity.hostname} (fp ${fingerprintShort(identity.fingerprint)}…) [${identity.os_platform}]`,
  );

  const bind = await remoteClient.bindMachine({
    fingerprint: identity.fingerprint,
    hostname: identity.hostname,
    os_platform: identity.os_platform,
    proxy_version: PROXY_VERSION,
  });

  if (!bind.ok) {
    console.error(`[dd-manager-proxy] FATAL: machine binding rejected — ${bind.reason}`);
    if ("hint" in bind && bind.hint) {
      console.error(`[dd-manager-proxy] ${bind.hint}`);
    }
    if (bind.reason === "swap_quota_exceeded") {
      console.error("[dd-manager-proxy]");
      console.error("[dd-manager-proxy] Your license is bound to a different machine and you've");
      console.error(`[dd-manager-proxy] used all ${bind.swap_window_days ?? 30}-day swap quota.`);
      console.error("[dd-manager-proxy] Email dancycodes@gmail.com to unblock.");
    } else {
      console.error("[dd-manager-proxy]");
      console.error("[dd-manager-proxy] Common causes: license invalid/expired, engine unreachable.");
      console.error("[dd-manager-proxy] Verify with: npx -y -p @dancycodesorg/dd-manager-proxy dancycodes-check-license");
    }
    process.exit(1);
  }

  // Print the prominent warning banner returned by the engine.
  console.error("");
  for (const line of bind.warning_text.split("\n")) {
    console.error(`[dd-manager-proxy] ${line}`);
  }
  console.error("");

  // Tell the RemoteClient to include the fingerprint header on every MCP tool call.
  remoteClient.setFingerprint(identity.fingerprint);

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
