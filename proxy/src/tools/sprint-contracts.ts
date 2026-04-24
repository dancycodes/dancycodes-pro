import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import { FeatureCodeSchema } from "../schemas.js";
import { ok, err, now } from "../helpers.js";
import { DEFAULT_SPRINT_CONTRACT_REVISIONS } from "../schemas.js";

interface ContractRow {
  id: number;
  feature_code: string;
  plan: string;
  status: string;
  feedback: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export function registerSprintContractTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "submit_sprint_contract",
    {
      title: "Submit implementation plan",
      description:
        "Executor submits the implementation plan before writing code. Creates a new contract (revision 0) or updates an existing pending/revised one (incrementing revision).",
      inputSchema: {
        feature_code: FeatureCodeSchema,
        plan: z.string().min(1).describe("Implementation plan (markdown)"),
      },
    },
    async ({ feature_code, plan }) => {
      const db = dm.getDb();
      const existing = db
        .prepare(
          "SELECT * FROM sprint_contracts WHERE feature_code = ? ORDER BY id DESC LIMIT 1",
        )
        .get(feature_code) as ContractRow | undefined;

      const maxRevisions = dm.getConfigInt(
        "sprint_contract_revisions",
        DEFAULT_SPRINT_CONTRACT_REVISIONS,
      );

      if (existing && existing.status === "approved") {
        return err(`Contract for ${feature_code} already approved. Cannot revise.`);
      }

      if (existing && existing.revision >= maxRevisions) {
        return err(
          `Max sprint contract revisions (${maxRevisions}) reached for ${feature_code}. Escalate to user.`,
        );
      }

      if (existing && (existing.status === "rejected" || existing.status === "pending")) {
        db.prepare(
          `UPDATE sprint_contracts SET plan = ?, status = 'revised', revision = revision + 1, updated_at = ? WHERE id = ?`,
        ).run(plan, now(), existing.id);
        return ok({
          status: "revised",
          feature_code,
          revision: existing.revision + 1,
        });
      }

      const result = db
        .prepare(
          `INSERT INTO sprint_contracts (feature_code, plan, status, revision) VALUES (?, ?, 'pending', 0)`,
        )
        .run(feature_code, plan);
      return ok({ status: "submitted", feature_code, contract_id: result.lastInsertRowid });
    },
  );

  server.registerTool(
    "approve_sprint_contract",
    {
      title: "Approve implementation plan",
      description: "Evaluator/orchestrator approves the latest plan for a feature.",
      inputSchema: { feature_code: FeatureCodeSchema },
    },
    async ({ feature_code }) => {
      const db = dm.getDb();
      const c = db
        .prepare(
          "SELECT * FROM sprint_contracts WHERE feature_code = ? ORDER BY id DESC LIMIT 1",
        )
        .get(feature_code) as ContractRow | undefined;
      if (!c) return err(`No sprint contract for ${feature_code}.`);

      db.prepare(
        `UPDATE sprint_contracts SET status = 'approved', updated_at = ? WHERE id = ?`,
      ).run(now(), c.id);
      return ok({ status: "approved", feature_code, contract_id: c.id });
    },
  );

  server.registerTool(
    "reject_sprint_contract",
    {
      title: "Reject implementation plan",
      description: "Reject the latest plan for a feature with feedback; executor must revise.",
      inputSchema: {
        feature_code: FeatureCodeSchema,
        feedback: z.string().describe("What must change"),
      },
    },
    async ({ feature_code, feedback }) => {
      const db = dm.getDb();
      const c = db
        .prepare(
          "SELECT * FROM sprint_contracts WHERE feature_code = ? ORDER BY id DESC LIMIT 1",
        )
        .get(feature_code) as ContractRow | undefined;
      if (!c) return err(`No sprint contract for ${feature_code}.`);

      db.prepare(
        `UPDATE sprint_contracts SET status = 'rejected', feedback = ?, updated_at = ? WHERE id = ?`,
      ).run(feedback, now(), c.id);
      return ok({ status: "rejected", feature_code, contract_id: c.id });
    },
  );
}
