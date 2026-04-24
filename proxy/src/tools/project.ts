import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DbManager } from "../db.js";
import {
  ProjectPhaseSchema,
  ActionSchema,
  TechStackItemSchema,
  AiStackItemSchema,
} from "../schemas.js";
import { ok, err, now, buildUpdateSets } from "../helpers.js";
import type { ProjectRow } from "../helpers.js";

export function registerProjectTools(server: McpServer, dm: DbManager): void {
  server.registerTool(
    "init_project",
    {
      title: "Initialize project",
      description:
        "Initialize a new DancyDev project. Creates the SQLite database at DD_DIR/dancydev.db and the singleton project record. Fails if already initialized.",
      inputSchema: {
        name: z.string().describe("Project name"),
        description: z.string().optional().describe("What the project does"),
        tech_stack: z.array(TechStackItemSchema).optional().describe("Technology stack"),
        ai_stack: z.array(AiStackItemSchema).optional().describe("AI tools stack"),
        excluded_tech: z.array(z.string()).optional().describe("Excluded technologies"),
        reactivity_framework: z
          .string()
          .optional()
          .describe("Reactivity framework (gale, livewire, htmx, react, etc.)"),
      },
    },
    async ({ name, description, tech_stack, ai_stack, excluded_tech, reactivity_framework }) => {
      if (dm.isInitialized()) {
        return err("Project already initialized. Use recover() to read current state.");
      }

      dm.initDb();
      const db = dm.getDb();
      const ts = now();
      db.prepare(
        `INSERT INTO project (id, name, description, phase, tech_stack, ai_stack, excluded_tech,
           reactivity_framework, total_features, completed_features, blocked_features, created_at, updated_at)
         VALUES (1, ?, ?, 'specs', ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
      ).run(
        name,
        description ?? null,
        JSON.stringify(tech_stack ?? []),
        JSON.stringify(ai_stack ?? []),
        JSON.stringify(excluded_tech ?? []),
        reactivity_framework ?? null,
        ts,
        ts,
      );

      return ok({ status: "initialized", name, phase: "specs" });
    },
  );

  server.registerTool(
    "save_project",
    {
      title: "Update project",
      description:
        "Update any project field (phase, stacks, concepts, intel briefing, current feature/action, etc.) and return updated fields.",
      inputSchema: {
        phase: ProjectPhaseSchema.optional(),
        description: z.string().optional(),
        tech_stack: z.array(TechStackItemSchema).optional(),
        ai_stack: z.array(AiStackItemSchema).optional(),
        excluded_tech: z.array(z.string()).optional(),
        general_concepts: z.string().optional(),
        reactivity_rules: z.string().optional(),
        reactivity_framework: z.string().optional(),
        claude_md_content: z.string().optional(),
        spec_state: z.string().optional(),
        intelligence_briefing: z.string().optional(),
        current_feature: z.string().nullable().optional(),
        current_action: ActionSchema.nullable().optional(),
      },
    },
    async (params) => {
      const db = dm.getDb();
      const { sets, values } = buildUpdateSets({
        phase: params.phase,
        description: params.description,
        tech_stack: params.tech_stack,
        ai_stack: params.ai_stack,
        excluded_tech: params.excluded_tech,
        general_concepts: params.general_concepts,
        reactivity_rules: params.reactivity_rules,
        reactivity_framework: params.reactivity_framework,
        claude_md_content: params.claude_md_content,
        spec_state: params.spec_state,
        intelligence_briefing: params.intelligence_briefing,
        current_feature: params.current_feature,
        current_action: params.current_action,
      });

      if (sets.length === 0) return err("No fields to update.");

      sets.push("updated_at = ?");
      values.push(now());

      db.prepare(`UPDATE project SET ${sets.join(", ")} WHERE id = 1`).run(...values);

      const p = db.prepare("SELECT * FROM project WHERE id = 1").get() as ProjectRow;
      return ok({
        status: "updated",
        fields: sets.map((s) => s.split(" = ")[0]).filter((f) => f !== "updated_at"),
        project: {
          name: p.name,
          description: p.description,
          phase: p.phase,
          reactivity_framework: p.reactivity_framework,
          tech_stack: JSON.parse(p.tech_stack),
          ai_stack: JSON.parse(p.ai_stack),
          excluded_tech: JSON.parse(p.excluded_tech),
          general_concepts: p.general_concepts,
          reactivity_rules: p.reactivity_rules,
          claude_md_content: p.claude_md_content,
          progress: {
            total: p.total_features,
            completed: p.completed_features,
            blocked: p.blocked_features,
          },
        },
      });
    },
  );
}
