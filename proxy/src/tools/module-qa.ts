import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import { FeatureCodeSchema, ModuleQaResultSchema } from "../schemas.js";
import { ok } from "../helpers.js";

export function registerModuleQaTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "record_module_qa_result",
    {
      title: "Record module QA sweep result",
      description:
        "Record the outcome of a module boundary QA sweep (interleaved during implementation).",
      inputSchema: {
        module: z.string(),
        features_tested: z.array(FeatureCodeSchema),
        bugs_found: z.number().int().min(0),
        bugs_fixed: z.number().int().min(0),
        result: ModuleQaResultSchema,
      },
    },
    async ({ module, features_tested, bugs_found, bugs_fixed, result }) => {
      const db = dm.getDb();
      db.prepare(
        `INSERT INTO module_qa_results (module, features_tested, bugs_found, bugs_fixed, result)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(module, JSON.stringify(features_tested), bugs_found, bugs_fixed, result);
      return ok({ status: "recorded", module, result });
    },
  );
}
