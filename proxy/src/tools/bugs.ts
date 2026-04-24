import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import {
  QaOrModuleCodeSchema,
  BugSeveritySchema,
  BugStatusSchema,
  FeatureCodeSchema,
} from "../schemas.js";
import { ok } from "../helpers.js";

export function registerBugTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "record_bug",
    {
      title: "Record a bug from QA",
      description:
        "Record a bug discovered during QA. Accepts QA-xxx or MODULE-{name} as qa_code (the latter for module boundary sweeps).",
      inputSchema: {
        qa_code: QaOrModuleCodeSchema,
        severity: BugSeveritySchema,
        title: z.string(),
        description: z.string(),
        steps_to_reproduce: z.string(),
        expected_behavior: z.string(),
        actual_behavior: z.string(),
        affected_features: z.array(FeatureCodeSchema).optional(),
      },
    },
    async (params) => {
      const db = dm.getDb();
      const result = db
        .prepare(
          `INSERT INTO bugs (qa_code, severity, title, description, steps_to_reproduce,
                              expected_behavior, actual_behavior, affected_features)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          params.qa_code,
          params.severity,
          params.title,
          params.description,
          params.steps_to_reproduce,
          params.expected_behavior,
          params.actual_behavior,
          JSON.stringify(params.affected_features ?? []),
        );
      return ok({ status: "recorded", bug_id: result.lastInsertRowid, severity: params.severity });
    },
  );

  server.registerTool(
    "get_bug_list",
    {
      title: "List bugs as markdown",
      description: "Bugs as a markdown table. Optional severity/status filters. Sorted by severity (critical first).",
      inputSchema: {
        severity: BugSeveritySchema.optional(),
        status: BugStatusSchema.optional(),
      },
    },
    async ({ severity, status }) => {
      const db = dm.getDb();
      let sql =
        "SELECT id, qa_code, severity, title, status, fix_code, affected_features FROM bugs WHERE 1=1";
      const params: unknown[] = [];
      if (severity) {
        sql += " AND severity = ?";
        params.push(severity);
      }
      if (status) {
        sql += " AND status = ?";
        params.push(status);
      }
      sql += " ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END, id";
      const rows = db.prepare(sql).all(...params) as Array<{
        id: number;
        qa_code: string;
        severity: string;
        title: string;
        status: string;
        fix_code: string | null;
        affected_features: string;
      }>;

      let md = "| ID | QA | Severity | Title | Status | Fix | Affected |\n";
      md += "|----|------|----------|-------|--------|-----|----------|\n";
      for (const b of rows) {
        const affected = JSON.parse(b.affected_features) as string[];
        md += `| ${b.id} | ${b.qa_code} | ${b.severity} | ${b.title} | ${b.status} | ${b.fix_code ?? "-"} | ${affected.join(",") || "-"} |\n`;
      }
      return ok({ count: rows.length, bugs: md });
    },
  );
}
