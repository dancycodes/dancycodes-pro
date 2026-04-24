import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import type { RemoteClient } from "./client.js";
import { FeatureCodeSchema, QaCodeSchema } from "../schemas.js";
import { ok, err, now, buildStateBlock, updateDenormalized } from "../helpers.js";
import type { FeatureRow, QaRow, FixRow, ProjectRow } from "../helpers.js";
import {
  readAllFeatures,
  readProjectState,
  rowToFeatureCtx,
  rowToQaCtx,
  rowToFixCtx,
  rowToProjectSummary,
} from "./context-builder.js";

/**
 * Registers the ~8 remote-forwarded tools on the proxy MCP server.
 *
 * These tools:
 * 1. Read local SQLite state to build the engine request payload
 * 2. Forward the request to the DancyCodes engine
 * 3. Apply any returned mutations to local SQLite
 * 4. Return the engine's response to the MCP client (Claude)
 */
export function registerRemoteTools(
  server: McpServer,
  dm: DbManager,
  client: RemoteClient,
): void {
  server.registerTool(
    "next_task",
    {
      title: "Next eligible feature (composite)",
      description:
        "Returns the next eligible feature plus conventions, recent errors, error stats, progress, and config. ONE call replaces FOUR. Forwarded to the DancyCodes engine for eligibility + context composition.",
      inputSchema: {},
    },
    async () => {
      if (!dm.isInitialized()) return err("Project not initialized.");

      const features = readAllFeatures(dm);
      const { project, conventions, recent_errors, error_stats, config } =
        readProjectState(dm);
      if (!project) return err("Project row missing.");

      const result = await client.callTool("dd_process_next_task", {
        features,
        conventions,
        recent_errors,
        error_stats,
        intelligence_briefing: project.intelligence_briefing,
        config,
        project_progress: {
          total: project.total_features,
          completed: project.completed_features,
          blocked: project.blocked_features,
        },
      });
      return ok(result);
    },
  );

  server.registerTool(
    "recover",
    {
      title: "Session recovery (composite)",
      description:
        "Composite recovery call: project + checkpoint + conventions + errors + current feature spec + pending amendments + config. Forwarded to the engine for processing and guidance.",
      inputSchema: {},
    },
    async () => {
      if (!dm.isInitialized()) return err("Project not initialized.");

      const db = dm.getDb();
      const { project, recovery, conventions, recent_errors, error_stats, config } =
        readProjectState(dm);
      if (!project) return err("Project row missing.");

      let currentFeature: FeatureRow | null = null;
      if (project.current_feature) {
        currentFeature = (db
          .prepare("SELECT * FROM features WHERE code = ?")
          .get(project.current_feature) as FeatureRow | undefined) ?? null;
      }

      const amendments = db
        .prepare(
          "SELECT id, feature_code, amendment_type, original_spec, corrected_behavior, discovered_by, status FROM amendments WHERE status = 'pending' ORDER BY id",
        )
        .all() as Array<{
        id: number;
        feature_code: string;
        amendment_type: string;
        original_spec: string;
        corrected_behavior: string;
        discovered_by: string;
        status: string;
      }>;

      const result = await client.callTool("dd_process_recover", {
        project: rowToProjectSummary(project),
        recovery,
        conventions,
        recent_errors,
        error_stats,
        current_feature_spec: currentFeature ? rowToFeatureCtx(currentFeature) : null,
        pending_amendments: amendments,
        config,
      });
      return ok(result);
    },
  );

  server.registerTool(
    "compute_sort_order",
    {
      title: "Topological sort of features",
      description:
        "Runs topological sort (with module locality bias and type/priority weighting) on all features and writes sort_order back to each row. Detects cycles.",
      inputSchema: {},
    },
    async () => {
      if (!dm.isInitialized()) return err("Project not initialized.");

      const features = readAllFeatures(dm);
      const result = (await client.callTool("dd_process_compute_sort_order", {
        features: features.map((f) => ({
          code: f.code,
          name: f.name,
          module: f.module,
          priority: f.priority,
          type: f.type,
          precedence: f.precedence,
        })),
      })) as {
        ok: boolean;
        order?: Array<{ sort_order: number; code: string }>;
        cycle_codes?: string[];
        error?: string;
      };

      if (!result.ok) {
        return err(result.error ?? "Sort failed");
      }

      const db = dm.getDb();
      const update = db.prepare("UPDATE features SET sort_order = ? WHERE code = ?");
      const applyAll = db.transaction((order: Array<{ sort_order: number; code: string }>) => {
        for (const o of order) update.run(o.sort_order, o.code);
      });
      applyAll(result.order ?? []);

      return ok({ status: "sorted", count: result.order?.length ?? 0, order: result.order });
    },
  );

  server.registerTool(
    "propose_feature",
    {
      title: "Propose a new feature (dedup-aware)",
      description:
        "Propose a new feature discovered during implementation. Engine runs Levenshtein-based dedup against existing features. If accepted, returns the next F-xxx code; if duplicate, returns existing feature info.",
      inputSchema: {
        name: z.string(),
        module: z.string().nullable(),
        rationale: z.string(),
        discovered_by: z.string(),
        priority: z.string(),
        type: z.string().optional(),
        precedence: z.array(FeatureCodeSchema).optional(),
        spec_draft: z.unknown().optional(),
      },
    },
    async (params) => {
      const db = dm.getDb();
      const existing = db
        .prepare("SELECT code, name, module FROM features")
        .all() as Array<{ code: string; name: string; module: string | null }>;

      const result = await client.callTool("dd_process_propose_feature", {
        ...params,
        existing_features: existing,
      });
      return ok(result);
    },
  );

  server.registerTool(
    "propose_qa_spec",
    {
      title: "Propose a new QA spec (dedup-aware)",
      description:
        "Propose a new QA spec discovered during QA. Engine runs dedup against existing QA specs.",
      inputSchema: {
        name: z.string(),
        category: z.string(),
        rationale: z.string(),
        discovered_by: z.string(),
        priority: z.string().optional(),
        covers_features: z.array(FeatureCodeSchema).optional(),
        spec_draft: z.unknown().optional(),
      },
    },
    async (params) => {
      const db = dm.getDb();
      const existing = db
        .prepare("SELECT code, name, category FROM qa_specs")
        .all() as Array<{ code: string; name: string; category: string }>;

      const result = await client.callTool("dd_process_propose_qa_spec", {
        ...params,
        existing_qa_specs: existing,
      });
      return ok(result);
    },
  );

  server.registerTool(
    "qa_recover",
    {
      title: "QA phase recovery (composite)",
      description: "Composite recovery for the QA phase. Returns progress, recent bugs, current QA spec, and guidance.",
      inputSchema: {},
    },
    async () => {
      if (!dm.isInitialized()) return err("Project not initialized.");

      const db = dm.getDb();
      const project = db.prepare("SELECT * FROM project WHERE id = 1").get() as
        | ProjectRow
        | undefined;
      if (!project) return err("Project row missing.");

      const qaCounts = db
        .prepare(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
             SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
             SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as pass,
             SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as fail
           FROM qa_specs`,
        )
        .get() as {
        total: number;
        done: number;
        blocked: number;
        pass: number;
        fail: number;
      };

      const bugs = db
        .prepare(
          "SELECT id, qa_code, severity, title, status, fix_code FROM bugs ORDER BY id DESC LIMIT 20",
        )
        .all() as Array<{
        id: number;
        qa_code: string;
        severity: string;
        title: string;
        status: string;
        fix_code: string | null;
      }>;

      let currentSpec: {
        code: string;
        name: string;
        category: string;
        priority: string;
        status: string;
        result: string | null;
      } | null = null;
      if (project.current_feature && project.current_feature.startsWith("QA-")) {
        const row = db
          .prepare(
            "SELECT code, name, category, priority, status, result FROM qa_specs WHERE code = ?",
          )
          .get(project.current_feature) as typeof currentSpec;
        currentSpec = row;
      }

      const recoveryRow = db
        .prepare("SELECT context_snapshot FROM recovery WHERE id = 1")
        .get() as { context_snapshot: string | null } | undefined;

      const result = await client.callTool("dd_process_qa_recover", {
        project: rowToProjectSummary(project),
        qa_progress: {
          total: qaCounts.total ?? 0,
          done: qaCounts.done ?? 0,
          blocked: qaCounts.blocked ?? 0,
          pass: qaCounts.pass ?? 0,
          fail: qaCounts.fail ?? 0,
        },
        recent_bugs: bugs,
        current_qa_spec: currentSpec,
        recovery_snapshot: recoveryRow?.context_snapshot ?? null,
      });
      return ok(result);
    },
  );

  server.registerTool(
    "next_qa_task",
    {
      title: "Next eligible QA spec",
      description: "Returns the next eligible QA spec + recent bugs + progress. Forwarded to engine.",
      inputSchema: {},
    },
    async () => {
      if (!dm.isInitialized()) return err("Project not initialized.");

      const db = dm.getDb();
      const specs = (
        db
          .prepare(
            "SELECT * FROM qa_specs ORDER BY sort_order, code",
          )
          .all() as QaRow[]
      ).map(rowToQaCtx);

      const bugs = db
        .prepare(
          "SELECT id, severity, title, status, qa_code FROM bugs WHERE status != 'fixed' ORDER BY id DESC LIMIT 10",
        )
        .all() as Array<{
        id: number;
        severity: string;
        title: string;
        status: string;
        qa_code: string;
      }>;

      const progress = db
        .prepare(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
             SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as pass,
             SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as fail,
             SUM(CASE WHEN result = 'partial' THEN 1 ELSE 0 END) as partial
           FROM qa_specs`,
        )
        .get() as {
        total: number;
        done: number;
        pass: number;
        fail: number;
        partial: number;
      };

      const result = await client.callTool("dd_process_next_qa_task", {
        qa_specs: specs,
        recent_bugs: bugs,
        progress: {
          total: progress.total ?? 0,
          done: progress.done ?? 0,
          pass: progress.pass ?? 0,
          fail: progress.fail ?? 0,
          partial: progress.partial ?? 0,
        },
      });
      return ok(result);
    },
  );

  server.registerTool(
    "next_fix_task",
    {
      title: "Next eligible fix",
      description:
        "Returns the next eligible fix sorted by severity (critical first). Forwarded to engine.",
      inputSchema: {},
    },
    async () => {
      if (!dm.isInitialized()) return err("Project not initialized.");

      const db = dm.getDb();
      const specs = (db.prepare("SELECT * FROM fix_specs").all() as FixRow[]).map(
        rowToFixCtx,
      );

      const progress = db
        .prepare(
          `SELECT
             COUNT(*) as total,
             SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
             SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
           FROM fix_specs`,
        )
        .get() as { total: number; done: number; blocked: number };

      const result = await client.callTool("dd_process_next_fix_task", {
        fix_specs: specs,
        progress: {
          total: progress.total ?? 0,
          done: progress.done ?? 0,
          blocked: progress.blocked ?? 0,
        },
      });
      return ok(result);
    },
  );
}
