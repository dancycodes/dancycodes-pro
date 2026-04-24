import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import { FeatureCodeSchema, EvaluationVerdictSchema } from "../schemas.js";
import { ok, now } from "../helpers.js";

export function registerEvaluationTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "record_evaluation",
    {
      title: "Record one evaluator review round",
      description:
        "Record a single evaluator round (pass/needs_fix/reject) with the issues found. Does not end the feature lifecycle — call finish_evaluation to close out.",
      inputSchema: {
        feature_code: FeatureCodeSchema,
        round: z.number().int().min(1),
        verdict: EvaluationVerdictSchema,
        issues: z.array(z.string()).default([]),
      },
    },
    async ({ feature_code, round, verdict, issues }) => {
      const db = dm.getDb();
      const result = db
        .prepare(
          `INSERT INTO evaluations (feature_code, round, verdict, issues) VALUES (?, ?, ?, ?)`,
        )
        .run(feature_code, round, verdict, JSON.stringify(issues));
      return ok({
        status: "recorded",
        evaluation_id: result.lastInsertRowid,
        feature_code,
        round,
        verdict,
      });
    },
  );

  server.registerTool(
    "finish_evaluation",
    {
      title: "Close evaluation cycle",
      description:
        "Final call for an evaluation cycle. Updates the latest evaluation row with fixed_issues and records per-feature metrics.",
      inputSchema: {
        feature_code: FeatureCodeSchema,
        verdict: EvaluationVerdictSchema,
        rounds_used: z.number().int().min(1),
        issues_found: z.number().int().min(0).default(0),
        issues_fixed: z.number().int().min(0).default(0),
      },
    },
    async ({ feature_code, verdict, rounds_used, issues_found, issues_fixed }) => {
      const db = dm.getDb();
      db.prepare(
        `INSERT INTO feature_metrics (feature_code, eval_rounds, evaluator_issues_found, evaluator_issues_fixed, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(feature_code) DO UPDATE SET
           eval_rounds = excluded.eval_rounds,
           evaluator_issues_found = excluded.evaluator_issues_found,
           evaluator_issues_fixed = excluded.evaluator_issues_fixed,
           updated_at = excluded.updated_at`,
      ).run(feature_code, rounds_used, issues_found, issues_fixed, now());
      return ok({ status: "finalized", feature_code, verdict, rounds_used });
    },
  );

  server.registerTool(
    "record_feature_metrics",
    {
      title: "Update per-feature metrics",
      description:
        "Record/update metrics for a feature (wall time, fix retries, sprint contract revisions, etc.).",
      inputSchema: {
        feature_code: FeatureCodeSchema,
        eval_rounds: z.number().int().optional(),
        fix_retries: z.number().int().optional(),
        wall_time_seconds: z.number().int().optional(),
        sprint_contract_revisions: z.number().int().optional(),
        evaluator_issues_found: z.number().int().optional(),
        evaluator_issues_fixed: z.number().int().optional(),
      },
    },
    async (params) => {
      const db = dm.getDb();
      db.prepare(
        `INSERT INTO feature_metrics (feature_code, eval_rounds, fix_retries, wall_time_seconds,
           sprint_contract_revisions, evaluator_issues_found, evaluator_issues_fixed, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(feature_code) DO UPDATE SET
           eval_rounds = COALESCE(excluded.eval_rounds, feature_metrics.eval_rounds),
           fix_retries = COALESCE(excluded.fix_retries, feature_metrics.fix_retries),
           wall_time_seconds = COALESCE(excluded.wall_time_seconds, feature_metrics.wall_time_seconds),
           sprint_contract_revisions = COALESCE(excluded.sprint_contract_revisions, feature_metrics.sprint_contract_revisions),
           evaluator_issues_found = COALESCE(excluded.evaluator_issues_found, feature_metrics.evaluator_issues_found),
           evaluator_issues_fixed = COALESCE(excluded.evaluator_issues_fixed, feature_metrics.evaluator_issues_fixed),
           updated_at = excluded.updated_at`,
      ).run(
        params.feature_code,
        params.eval_rounds ?? null,
        params.fix_retries ?? null,
        params.wall_time_seconds ?? null,
        params.sprint_contract_revisions ?? null,
        params.evaluator_issues_found ?? null,
        params.evaluator_issues_fixed ?? null,
        now(),
      );
      return ok({ status: "updated", feature_code: params.feature_code });
    },
  );
}
