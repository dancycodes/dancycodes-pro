import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import { FeatureCodeSchema, ErrorCategorySchema, AmendmentTypeSchema } from "../schemas.js";
import { ok, err, fifoErrors } from "../helpers.js";

export function registerErrorsConventionsTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "record_error",
    {
      title: "Record error + resolution + lesson",
      description:
        "Record a single error encountered during implementation, its resolution, and the lesson learned. FIFO-capped per config.",
      inputSchema: {
        feature_code: z.string(),
        category: ErrorCategorySchema,
        error: z.string().describe("What went wrong"),
        resolution: z.string().describe("How it was fixed"),
        lesson: z.string().describe("Lesson for future features"),
      },
    },
    async ({ feature_code, category, error, resolution, lesson }) => {
      const db = dm.getDb();
      db.prepare(
        `INSERT INTO errors (feature_code, category, error, resolution, lesson) VALUES (?, ?, ?, ?, ?)`,
      ).run(feature_code, category, error, resolution, lesson);
      fifoErrors(dm);
      return ok({ status: "recorded", feature_code, category });
    },
  );

  server.registerTool(
    "record_convention",
    {
      title: "Record coding convention",
      description: "Record a coding pattern/convention established during a feature's implementation.",
      inputSchema: {
        feature_code: z.string(),
        name: z.string().describe("Convention name"),
        patterns: z.array(z.string()).describe("Array of pattern strings"),
      },
    },
    async ({ feature_code, name, patterns }) => {
      const db = dm.getDb();
      db.prepare(
        `INSERT INTO conventions (feature_code, name, patterns) VALUES (?, ?, ?)`,
      ).run(feature_code, name, JSON.stringify(patterns));
      return ok({ status: "recorded", feature_code, name });
    },
  );

  server.registerTool(
    "record_amendment",
    {
      title: "Record spec amendment",
      description:
        "Record a spec correction discovered while implementing another feature. Used to fix specs without breaking the audit trail.",
      inputSchema: {
        feature_code: FeatureCodeSchema.describe("Feature whose spec needs correcting"),
        amendment_type: AmendmentTypeSchema,
        original_spec: z.string().describe("What the spec originally said"),
        corrected_behavior: z.string().describe("What it should be"),
        discovered_by: z.string().describe("Code of feature that discovered this"),
      },
    },
    async ({ feature_code, amendment_type, original_spec, corrected_behavior, discovered_by }) => {
      const db = dm.getDb();
      const result = db
        .prepare(
          `INSERT INTO amendments (feature_code, amendment_type, original_spec, corrected_behavior, discovered_by)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(feature_code, amendment_type, original_spec, corrected_behavior, discovered_by);
      return ok({
        status: "recorded",
        amendment_id: result.lastInsertRowid,
        feature_code,
      });
    },
  );
}
