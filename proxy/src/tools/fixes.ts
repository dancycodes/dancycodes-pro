import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import {
  FixCodeSchema,
  FeatureCodeSchema,
  FeatureStatusSchema,
  BugSeveritySchema,
  SaveFeaturesModeSchema,
  FixSpecDataSchema,
  ConstraintsSchema,
} from "../schemas.js";
import { ok, err, now, buildUpdateSets } from "../helpers.js";
import type { FixRow } from "../helpers.js";

const FixInputSchema = z.object({
  code: FixCodeSchema,
  bug_id: z.number().int().optional(),
  name: z.string().optional(),
  severity: BugSeveritySchema.optional(),
  affected_features: z.array(FeatureCodeSchema).optional(),
  dependency_impact: z.array(FeatureCodeSchema).optional(),
  status: FeatureStatusSchema.optional(),
  constraints: ConstraintsSchema.optional(),
  spec_data: FixSpecDataSchema.optional(),
  implementation_summary: z.string().optional(),
  key_files: z.array(z.string()).optional(),
  sort_order: z.number().int().optional(),
});

export function registerFixTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "save_fix_specs",
    {
      title: "Batch upsert fix specs",
      description:
        "Upsert 1-N fix specs. On insert, auto-links the bug (status → 'fixing'). Same semantics as save_features.",
      inputSchema: {
        mode: SaveFeaturesModeSchema.default("upsert"),
        specs: z.array(FixInputSchema),
      },
    },
    async ({ mode, specs }) => {
      const db = dm.getDb();
      const results: Array<{ code: string; action: string }> = [];
      const defaultConstraints = {
        skills: [],
        instructions: [],
        test_strategy: "playwright",
        regression_check: [],
      };

      const insertFix = (f: z.infer<typeof FixInputSchema>) => {
        if (!f.name || !f.severity) {
          throw new Error(`Fix ${f.code}: name and severity required for insert.`);
        }
        db.prepare(
          `INSERT INTO fix_specs (code, bug_id, name, severity, affected_features,
             dependency_impact, constraints, spec_data, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          f.code,
          f.bug_id ?? null,
          f.name,
          f.severity,
          JSON.stringify(f.affected_features ?? []),
          JSON.stringify(f.dependency_impact ?? []),
          JSON.stringify(f.constraints ?? defaultConstraints),
          f.spec_data ? JSON.stringify(f.spec_data) : null,
          f.sort_order ?? 0,
        );
        if (f.bug_id !== undefined) {
          db.prepare("UPDATE bugs SET status = 'fixing', fix_code = ? WHERE id = ?").run(
            f.code,
            f.bug_id,
          );
        }
        results.push({ code: f.code, action: "inserted" });
      };

      const updateFix = (f: z.infer<typeof FixInputSchema>) => {
        const { sets, values } = buildUpdateSets({
          bug_id: f.bug_id,
          name: f.name,
          severity: f.severity,
          affected_features: f.affected_features,
          dependency_impact: f.dependency_impact,
          status: f.status,
          constraints: f.constraints,
          spec_data: f.spec_data,
          implementation_summary: f.implementation_summary,
          key_files: f.key_files,
          sort_order: f.sort_order,
        });
        if (sets.length > 0) {
          db.prepare(`UPDATE fix_specs SET ${sets.join(", ")} WHERE code = ?`).run(
            ...values,
            f.code,
          );
        }
        results.push({ code: f.code, action: "updated" });
      };

      const doSave = db.transaction(() => {
        for (const f of specs) {
          if (mode === "insert") {
            insertFix(f);
          } else if (mode === "update") {
            const exists = db.prepare("SELECT code FROM fix_specs WHERE code = ?").get(f.code);
            if (!exists) throw new Error(`Fix ${f.code} not found for update.`);
            updateFix(f);
          } else {
            const exists = db.prepare("SELECT code FROM fix_specs WHERE code = ?").get(f.code);
            if (exists) updateFix(f);
            else insertFix(f);
          }
        }
      });

      doSave();
      return ok({ status: "saved", count: results.length, results });
    },
  );

  server.registerTool(
    "begin_fix_task",
    {
      title: "Start a fix",
      description: "Mark a fix as in_progress.",
      inputSchema: { code: FixCodeSchema },
    },
    async ({ code }) => {
      const db = dm.getDb();
      const f = db.prepare("SELECT * FROM fix_specs WHERE code = ?").get(code) as
        | FixRow
        | undefined;
      if (!f) return err(`Fix ${code} not found.`);
      const ts = now();
      db.prepare(
        "UPDATE fix_specs SET status = 'in_progress', started_at = COALESCE(started_at, ?) WHERE code = ?",
      ).run(ts, code);
      return ok({ status: "begun", code, name: f.name });
    },
  );

  server.registerTool(
    "finish_fix_task",
    {
      title: "Complete a fix",
      description: "Mark a fix as done, with optional summary and key files. Auto-marks linked bug as fixed.",
      inputSchema: {
        code: FixCodeSchema,
        summary: z.string().optional(),
        key_files: z.array(z.string()).optional(),
      },
    },
    async ({ code, summary, key_files }) => {
      const db = dm.getDb();
      const f = db.prepare("SELECT * FROM fix_specs WHERE code = ?").get(code) as
        | FixRow
        | undefined;
      if (!f) return err(`Fix ${code} not found.`);
      const ts = now();
      db.prepare(
        `UPDATE fix_specs SET status = 'done', completed_at = ?,
           implementation_summary = COALESCE(?, implementation_summary),
           key_files = COALESCE(?, key_files)
         WHERE code = ?`,
      ).run(ts, summary ?? null, key_files ? JSON.stringify(key_files) : null, code);

      if (f.bug_id !== null) {
        db.prepare("UPDATE bugs SET status = 'fixed' WHERE id = ?").run(f.bug_id);
      }
      return ok({ status: "completed", code, bug_id: f.bug_id });
    },
  );

  server.registerTool(
    "get_fix_catalog",
    {
      title: "Fix catalog as markdown",
      description: "Fix specs as markdown table. Sorted by severity (critical first).",
      inputSchema: {
        status: FeatureStatusSchema.optional(),
        severity: BugSeveritySchema.optional(),
      },
    },
    async ({ status, severity }) => {
      const db = dm.getDb();
      let sql =
        "SELECT code, name, severity, status, sort_order, bug_id FROM fix_specs WHERE 1=1";
      const params: unknown[] = [];
      if (status) {
        sql += " AND status = ?";
        params.push(status);
      }
      if (severity) {
        sql += " AND severity = ?";
        params.push(severity);
      }
      sql +=
        " ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END, sort_order, code";
      const rows = db.prepare(sql).all(...params) as Array<{
        code: string;
        name: string;
        severity: string;
        status: string;
        sort_order: number;
        bug_id: number | null;
      }>;

      let md = "| Code | Name | Severity | Status | Bug |\n";
      md += "|------|------|----------|--------|-----|\n";
      for (const f of rows) {
        md += `| ${f.code} | ${f.name} | ${f.severity} | ${f.status} | ${f.bug_id ?? "-"} |\n`;
      }
      return ok({ count: rows.length, catalog: md });
    },
  );
}
