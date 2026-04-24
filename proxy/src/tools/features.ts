import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import {
  FeatureCodeSchema,
  FeatureStatusSchema,
  FeatureTypeSchema,
  PrioritySchema,
  SaveFeaturesModeSchema,
  ConstraintsSchema,
  SpecDataSchema,
} from "../schemas.js";
import { ok, err, buildUpdateSets, updateDenormalized } from "../helpers.js";
import type { FeatureRow } from "../helpers.js";

const FeatureInputSchema = z.object({
  code: FeatureCodeSchema,
  name: z.string().optional(),
  module: z.string().optional(),
  priority: PrioritySchema.optional(),
  type: FeatureTypeSchema.optional(),
  precedence: z.array(FeatureCodeSchema).optional(),
  status: FeatureStatusSchema.optional(),
  constraints: ConstraintsSchema.optional(),
  spec_data: SpecDataSchema.optional(),
  implementation_summary: z.string().optional(),
  key_files: z.array(z.string()).optional(),
  sort_order: z.number().int().optional(),
});

export function registerFeatureTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "save_features",
    {
      title: "Batch upsert features",
      description:
        "Upsert 1-N features in a single transaction. Mode: insert (fail on duplicate), update (fail on not found), upsert (insert or replace).",
      inputSchema: {
        mode: SaveFeaturesModeSchema.default("upsert"),
        features: z.array(FeatureInputSchema),
      },
    },
    async ({ mode, features }) => {
      const db = dm.getDb();
      const results: Array<{ code: string; action: string }> = [];

      const defaultConstraints = {
        skills: [],
        instructions: [],
        test_strategy: "playwright",
        regression_check: [],
      };

      const insertFeature = (f: z.infer<typeof FeatureInputSchema>) => {
        if (!f.name || !f.priority) {
          throw new Error(`Feature ${f.code}: name and priority required for insert.`);
        }
        db.prepare(
          `INSERT INTO features (code, name, module, priority, type, precedence, constraints, spec_data, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          f.code,
          f.name,
          f.module ?? null,
          f.priority,
          f.type ?? "functional",
          JSON.stringify(f.precedence ?? []),
          JSON.stringify(f.constraints ?? defaultConstraints),
          f.spec_data ? JSON.stringify(f.spec_data) : null,
          f.sort_order ?? 0,
        );
        results.push({ code: f.code, action: "inserted" });
      };

      const updateFeature = (f: z.infer<typeof FeatureInputSchema>) => {
        const { sets, values } = buildUpdateSets({
          name: f.name,
          module: f.module,
          priority: f.priority,
          type: f.type,
          precedence: f.precedence,
          status: f.status,
          constraints: f.constraints,
          spec_data: f.spec_data,
          implementation_summary: f.implementation_summary,
          key_files: f.key_files,
          sort_order: f.sort_order,
        });
        if (sets.length > 0) {
          db.prepare(`UPDATE features SET ${sets.join(", ")} WHERE code = ?`).run(
            ...values,
            f.code,
          );
        }
        results.push({ code: f.code, action: "updated" });
      };

      const doSave = db.transaction(() => {
        for (const f of features) {
          if (mode === "insert") {
            insertFeature(f);
          } else if (mode === "update") {
            const exists = db.prepare("SELECT code FROM features WHERE code = ?").get(f.code);
            if (!exists) throw new Error(`Feature ${f.code} not found for update.`);
            updateFeature(f);
          } else {
            const exists = db.prepare("SELECT code FROM features WHERE code = ?").get(f.code);
            if (exists) updateFeature(f);
            else insertFeature(f);
          }
        }
      });

      doSave();
      updateDenormalized(dm);
      return ok({ status: "saved", count: results.length, results });
    },
  );

  server.registerTool(
    "get_catalog",
    {
      title: "Feature catalog",
      description: "Return features as a compact markdown table. Supports status/priority/module filters.",
      inputSchema: {
        status: FeatureStatusSchema.optional(),
        priority: PrioritySchema.optional(),
        module: z.string().optional(),
      },
    },
    async ({ status, priority, module }) => {
      const db = dm.getDb();
      let sql =
        "SELECT code, name, module, priority, type, status, sort_order FROM features WHERE 1=1";
      const params: unknown[] = [];
      if (status) {
        sql += " AND status = ?";
        params.push(status);
      }
      if (priority) {
        sql += " AND priority = ?";
        params.push(priority);
      }
      if (module) {
        sql += " AND module = ?";
        params.push(module);
      }
      sql += " ORDER BY sort_order, code";

      const features = db.prepare(sql).all(...params) as Array<{
        code: string;
        name: string;
        module: string | null;
        priority: string;
        type: string;
        status: string;
        sort_order: number;
      }>;

      let md = "| Code | Name | Module | Priority | Type | Status |\n";
      md += "|------|------|--------|----------|------|--------|\n";
      for (const f of features) {
        const icon =
          f.status === "done"
            ? "done"
            : f.status === "blocked"
              ? "BLOCKED"
              : f.status === "in_progress"
                ? "WIP"
                : "pending";
        md += `| ${f.code} | ${f.name} | ${f.module ?? ""} | ${f.priority} | ${f.type} | ${icon} |\n`;
      }

      return ok({ count: features.length, catalog: md });
    },
  );

  server.registerTool(
    "get_feature_detail",
    {
      title: "Read feature with full spec",
      description: "Return one feature's full record including spec_data, constraints, key_files.",
      inputSchema: { code: FeatureCodeSchema },
    },
    async ({ code }) => {
      const db = dm.getDb();
      const f = db.prepare("SELECT * FROM features WHERE code = ?").get(code) as
        | FeatureRow
        | undefined;
      if (!f) return err(`Feature ${code} not found.`);

      return ok({
        code: f.code,
        name: f.name,
        module: f.module,
        priority: f.priority,
        type: f.type,
        precedence: JSON.parse(f.precedence),
        status: f.status,
        constraints: JSON.parse(f.constraints),
        spec_data: f.spec_data ? JSON.parse(f.spec_data) : null,
        implementation_summary: f.implementation_summary,
        key_files: f.key_files ? JSON.parse(f.key_files) : [],
        sort_order: f.sort_order,
        started_at: f.started_at,
        completed_at: f.completed_at,
      });
    },
  );
}
