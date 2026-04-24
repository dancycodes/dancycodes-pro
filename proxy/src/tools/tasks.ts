import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import { FeatureCodeSchema } from "../schemas.js";
import {
  ok,
  err,
  now,
  updateDenormalized,
  fifoErrors,
  buildStateBlock,
} from "../helpers.js";
import type { ProjectRow, FeatureRow } from "../helpers.js";

function writeCheckpoint(
  dm: DbManager,
  lastFeature: string | null,
  lastAction: string | null,
  snapshot: string,
): void {
  const db = dm.getDb();
  db.prepare(
    `UPDATE recovery SET last_feature = ?, last_action = ?, context_snapshot = ?, updated_at = ? WHERE id = 1`,
  ).run(lastFeature, lastAction, snapshot, now());
}

export function registerTaskTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "begin_task",
    {
      title: "Start a feature",
      description:
        "Mark a feature as in_progress and set it as the project's current feature. Automatically writes a recovery checkpoint and updates the CLAUDE.md state block.",
      inputSchema: { code: FeatureCodeSchema },
    },
    async ({ code }) => {
      const db = dm.getDb();
      const f = db.prepare("SELECT * FROM features WHERE code = ?").get(code) as
        | FeatureRow
        | undefined;
      if (!f) return err(`Feature ${code} not found.`);
      if (f.status === "done") return err(`Feature ${code} is already done.`);

      const ts = now();
      db.prepare(
        "UPDATE features SET status = 'in_progress', started_at = COALESCE(started_at, ?) WHERE code = ?",
      ).run(ts, code);
      db.prepare(
        "UPDATE project SET current_feature = ?, current_action = 'implementing', updated_at = ? WHERE id = 1",
      ).run(code, ts);

      updateDenormalized(dm);
      writeCheckpoint(dm, code, "implementing", `Started ${code}: ${f.name}`);

      const p = db.prepare("SELECT * FROM project WHERE id = 1").get() as ProjectRow;
      dm.updateClaudeMdState(buildStateBlock(p));

      return ok({ status: "begun", code, name: f.name });
    },
  );

  server.registerTool(
    "finish_task",
    {
      title: "Complete a feature",
      description:
        "Mark a feature as done. Records implementation summary and key files. Writes checkpoint and updates CLAUDE.md state.",
      inputSchema: {
        code: FeatureCodeSchema,
        summary: z.string().optional().describe("What was implemented"),
        key_files: z.array(z.string()).optional().describe("Files created/modified"),
      },
    },
    async ({ code, summary, key_files }) => {
      const db = dm.getDb();
      const f = db.prepare("SELECT * FROM features WHERE code = ?").get(code) as
        | FeatureRow
        | undefined;
      if (!f) return err(`Feature ${code} not found.`);

      const ts = now();
      db.prepare(
        `UPDATE features SET status = 'done', completed_at = ?,
           implementation_summary = COALESCE(?, implementation_summary),
           key_files = COALESCE(?, key_files)
         WHERE code = ?`,
      ).run(
        ts,
        summary ?? null,
        key_files ? JSON.stringify(key_files) : null,
        code,
      );

      db.prepare(
        "UPDATE project SET current_feature = NULL, current_action = NULL, updated_at = ? WHERE id = 1",
      ).run(ts);

      updateDenormalized(dm);
      writeCheckpoint(dm, code, "completed", `Completed ${code}: ${f.name}`);

      const p = db.prepare("SELECT * FROM project WHERE id = 1").get() as ProjectRow;
      dm.updateClaudeMdState(buildStateBlock(p));

      return ok({
        status: "completed",
        code,
        progress: {
          total: p.total_features,
          completed: p.completed_features,
          blocked: p.blocked_features,
        },
      });
    },
  );

  server.registerTool(
    "block_task",
    {
      title: "Block a feature",
      description:
        "Mark a feature as blocked. Auto-records an error entry with the reason. Clears current_feature on project.",
      inputSchema: {
        code: FeatureCodeSchema,
        reason: z.string().describe("Why the feature is blocked"),
      },
    },
    async ({ code, reason }) => {
      const db = dm.getDb();
      const f = db.prepare("SELECT * FROM features WHERE code = ?").get(code) as
        | FeatureRow
        | undefined;
      if (!f) return err(`Feature ${code} not found.`);

      const ts = now();
      db.prepare("UPDATE features SET status = 'blocked' WHERE code = ?").run(code);
      db.prepare(
        `INSERT INTO errors (feature_code, category, error, resolution, lesson)
         VALUES (?, 'infrastructure', ?, 'Blocked — pending resolution', ?)`,
      ).run(code, reason, `Feature ${code} blocked: ${reason}`);
      db.prepare(
        "UPDATE project SET current_feature = NULL, current_action = NULL, updated_at = ? WHERE id = 1",
      ).run(ts);

      updateDenormalized(dm);
      fifoErrors(dm);
      writeCheckpoint(dm, code, "blocked", `Blocked ${code}: ${reason}`);

      return ok({ status: "blocked", code, reason });
    },
  );

  server.registerTool(
    "checkpoint",
    {
      title: "Manual recovery checkpoint",
      description:
        "Write a human-readable context snapshot to the recovery row. Called manually when begin_task/finish_task auto-checkpoints aren't enough.",
      inputSchema: { context: z.string().describe("Human-readable state snapshot") },
    },
    async ({ context }) => {
      const db = dm.getDb();
      const p = db.prepare("SELECT * FROM project WHERE id = 1").get() as
        | ProjectRow
        | undefined;
      writeCheckpoint(
        dm,
        p?.current_feature ?? null,
        p?.current_action ?? null,
        context,
      );
      return ok({ status: "checkpointed" });
    },
  );
}
