#!/usr/bin/env node
// Standalone license diagnostic.
//   Usage: DANCYCODES_LICENSE_KEY=DCP-xxx-xxx npx -y @dancycodesorg/dd-manager-proxy check-license
//
// Prints the engine's response and exits 0 (valid) or 1 (anything else).

const DEFAULT_URL = "https://dancycodes-engine.dancycodes.workers.dev";

const key = process.env.DANCYCODES_LICENSE_KEY ?? "";
const engineUrl = (process.env.DANCYCODES_ENGINE_URL ?? `${DEFAULT_URL}/mcp`).replace(/\/mcp\/?$/, "");

if (!key) {
  console.error("[check-license] DANCYCODES_LICENSE_KEY env var is not set.");
  console.error("[check-license] Run: DANCYCODES_LICENSE_KEY=DCP-XXX-XXX npx -y @dancycodesorg/dd-manager-proxy check-license");
  process.exit(1);
}

(async () => {
  try {
    const response = await fetch(`${engineUrl}/licenses/check`, {
      method: "GET",
      headers: { Accept: "application/json", "X-License-Key": key },
    });
    const data = await response.json();

    if (data.valid) {
      console.log(`[check-license] OK — ${data.plan} plan for ${data.email}`);
      process.exit(0);
    }
    console.error(`[check-license] INVALID — ${data.reason ?? "no reason given"}`);
    console.error(`[check-license] HTTP ${response.status}`);
    process.exit(1);
  } catch (err) {
    console.error(`[check-license] Could not reach engine at ${engineUrl}: ${err.message}`);
    process.exit(1);
  }
})();
