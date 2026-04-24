import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import { ok, getAllConfig } from "../helpers.js";

export function registerConfigTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "get_config",
    {
      title: "Read config values",
      description:
        "Read one config value by key, or all config values when no key is provided.",
      inputSchema: { key: z.string().optional() },
    },
    async ({ key }) => {
      if (key) {
        return ok({ key, value: dm.getConfig(key) });
      }
      return ok({ config: getAllConfig(dm) });
    },
  );

  server.registerTool(
    "set_config",
    {
      title: "Update a config value",
      description:
        "Update a configurable limit (e.g. max_fix_retries, max_eval_rounds, max_error_entries).",
      inputSchema: {
        key: z.string(),
        value: z.string().describe("New value (stored as string; parsed on read)"),
      },
    },
    async ({ key, value }) => {
      const db = dm.getDb();
      db.prepare(
        `INSERT INTO config (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      ).run(key, value);
      return ok({ status: "updated", key, value });
    },
  );
}
