import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import {
  QaCodeSchema,
  FeatureCodeSchema,
  PrioritySchema,
  FeatureStatusSchema,
  SaveFeaturesModeSchema,
  QaCategorySchema,
  QaResultSchema,
  QaSpecDataSchema,
  ConstraintsSchema,
} from "../schemas.js";
import { ok, err, buildUpdateSets, now } from "../helpers.js";
import type { QaRow, ProjectRow } from "../helpers.js";

const QaInputSchema = z.object({
  code: QaCodeSchema,
  name: z.string().optional(),
  category: QaCategorySchema.optional(),
  priority: PrioritySchema.optional(),
  covers_features: z.array(FeatureCodeSchema).optional(),
  precedence: z.array(QaCodeSchema).optional(),
  status: FeatureStatusSchema.optional(),
  constraints: ConstraintsSchema.optional(),
  spec_data: QaSpecDataSchema.optional(),
  result: QaResultSchema.optional(),
  findings: z.string().optional(),
  sort_order: z.number().int().optional(),
});

export function registerQaTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "save_qa_specs",
    {
      title: "Batch upsert QA specs",
      description:
        "Upsert 1-N QA specs in a single transaction. Same semantics as save_features.",
      inputSchema: {
        mode: SaveFeaturesModeSchema.default("upsert"),
        specs: z.array(QaInputSchema),
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

      const insertQa = (q: z.infer<typeof QaInputSchema>) => {
        if (!q.name || !q.category || !q.priority) {
          throw new Error(`QA ${q.code}: name, category, priority required for insert.`);
        }
        db.prepare(
          `INSERT INTO qa_specs (code, name, category, priority, covers_features, precedence, constraints, spec_data, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          q.code,
          q.name,
          q.category,
          q.priority,
          JSON.stringify(q.covers_features ?? []),
          JSON.stringify(q.precedence ?? []),
          JSON.stringify(q.constraints ?? defaultConstraints),
          q.spec_data ? JSON.stringify(q.spec_data) : null,
          q.sort_order ?? 0,
        );
        results.push({ code: q.code, action: "inserted" });
      };

      const updateQa = (q: z.infer<typeof QaInputSchema>) => {
        const { sets, values } = buildUpdateSets({
          name: q.name,
          category: q.category,
          priority: q.priority,
          covers_features: q.covers_features,
          precedence: q.precedence,
          status: q.status,
          constraints: q.constraints,
          spec_data: q.spec_data,
          result: q.result,
          findings: q.findings,
          sort_order: q.sort_order,
        });
        if (sets.length > 0) {
          db.prepare(`UPDATE qa_specs SET ${sets.join(", ")} WHERE code = ?`).run(
            ...values,
            q.code,
          );
        }
        results.push({ code: q.code, action: "updated" });
      };

      const doSave = db.transaction(() => {
        for (const q of specs) {
          if (mode === "insert") {
            insertQa(q);
          } else if (mode === "update") {
            const exists = db.prepare("SELECT code FROM qa_specs WHERE code = ?").get(q.code);
            if (!exists) throw new Error(`QA ${q.code} not found for update.`);
            updateQa(q);
          } else {
            const exists = db.prepare("SELECT code FROM qa_specs WHERE code = ?").get(q.code);
            if (exists) updateQa(q);
            else insertQa(q);
          }
        }
      });

      doSave();
      return ok({ status: "saved", count: results.length, results });
    },
  );

  server.registerTool(
    "begin_qa_task",
    {
      title: "Start a QA spec",
      description: "Mark a QA spec in_progress and record a checkpoint.",
      inputSchema: { code: QaCodeSchema },
    },
    async ({ code }) => {
      const db = dm.getDb();
      const q = db.prepare("SELECT * FROM qa_specs WHERE code = ?").get(code) as
        | QaRow
        | undefined;
      if (!q) return err(`QA spec ${code} not found.`);
      const ts = now();
      db.prepare(
        "UPDATE qa_specs SET status = 'in_progress', started_at = COALESCE(started_at, ?) WHERE code = ?",
      ).run(ts, code);
      db.prepare(
        `UPDATE recovery SET last_feature = ?, last_action = 'testing', context_snapshot = ?, updated_at = ? WHERE id = 1`,
      ).run(code, `Started QA ${code}: ${q.name}`, ts);
      return ok({ status: "begun", code, name: q.name });
    },
  );

  server.registerTool(
    "finish_qa_task",
    {
      title: "Complete a QA spec",
      description: "Mark a QA spec done with result (pass/fail/partial) and optional findings.",
      inputSchema: {
        code: QaCodeSchema,
        result: QaResultSchema,
        findings: z.string().optional(),
      },
    },
    async ({ code, result, findings }) => {
      const db = dm.getDb();
      const q = db.prepare("SELECT * FROM qa_specs WHERE code = ?").get(code) as
        | QaRow
        | undefined;
      if (!q) return err(`QA spec ${code} not found.`);
      const ts = now();
      db.prepare(
        `UPDATE qa_specs SET status = 'done', result = ?, findings = COALESCE(?, findings), completed_at = ?
         WHERE code = ?`,
      ).run(result, findings ?? null, ts, code);
      return ok({ status: "completed", code, result });
    },
  );

  server.registerTool(
    "block_qa_task",
    {
      title: "Block a QA spec",
      description: "Mark a QA spec as blocked with a reason.",
      inputSchema: { code: QaCodeSchema, reason: z.string() },
    },
    async ({ code, reason }) => {
      const db = dm.getDb();
      const q = db.prepare("SELECT code FROM qa_specs WHERE code = ?").get(code);
      if (!q) return err(`QA spec ${code} not found.`);
      db.prepare("UPDATE qa_specs SET status = 'blocked' WHERE code = ?").run(code);
      return ok({ status: "blocked", code, reason });
    },
  );

  server.registerTool(
    "get_qa_catalog",
    {
      title: "QA catalog as markdown",
      description:
        "QA specs as markdown table with optional status/category/result filters.",
      inputSchema: {
        status: FeatureStatusSchema.optional(),
        category: QaCategorySchema.optional(),
        result: QaResultSchema.optional(),
      },
    },
    async ({ status, category, result }) => {
      const db = dm.getDb();
      let sql =
        "SELECT code, name, category, priority, status, result, sort_order FROM qa_specs WHERE 1=1";
      const params: unknown[] = [];
      if (status) {
        sql += " AND status = ?";
        params.push(status);
      }
      if (category) {
        sql += " AND category = ?";
        params.push(category);
      }
      if (result) {
        sql += " AND result = ?";
        params.push(result);
      }
      sql += " ORDER BY sort_order, code";
      const rows = db.prepare(sql).all(...params) as Array<{
        code: string;
        name: string;
        category: string;
        priority: string;
        status: string;
        result: string | null;
        sort_order: number;
      }>;

      let md = "| Code | Name | Category | Priority | Status | Result |\n";
      md += "|------|------|----------|----------|--------|--------|\n";
      for (const r of rows) {
        md += `| ${r.code} | ${r.name} | ${r.category} | ${r.priority} | ${r.status} | ${r.result ?? "-"} |\n`;
      }
      return ok({ count: rows.length, catalog: md });
    },
  );
}
