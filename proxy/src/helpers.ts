import type { DbManager } from "./db.js";
import { DEFAULT_MAX_ERROR_ENTRIES } from "./schemas.js";

// =========== Response builders ===========

export function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function err(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

export function now(): string {
  return new Date().toISOString();
}

// =========== Row types (mirror DB schema) ===========

export interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  phase: string;
  tech_stack: string;
  ai_stack: string;
  excluded_tech: string;
  general_concepts: string | null;
  reactivity_rules: string | null;
  reactivity_framework: string | null;
  claude_md_content: string | null;
  spec_state: string | null;
  intelligence_briefing: string | null;
  total_features: number;
  completed_features: number;
  blocked_features: number;
  current_feature: string | null;
  current_action: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureRow {
  code: string;
  name: string;
  module: string | null;
  priority: string;
  type: string;
  precedence: string;
  status: string;
  constraints: string;
  spec_data: string | null;
  implementation_summary: string | null;
  key_files: string | null;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface QaRow {
  code: string;
  name: string;
  category: string;
  priority: string;
  covers_features: string;
  precedence: string;
  status: string;
  constraints: string;
  spec_data: string | null;
  result: string | null;
  findings: string | null;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface FixRow {
  code: string;
  bug_id: number | null;
  name: string;
  severity: string;
  affected_features: string;
  dependency_impact: string;
  status: string;
  constraints: string;
  spec_data: string | null;
  implementation_summary: string | null;
  key_files: string | null;
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
}

// =========== DRY helpers ===========

/** Build a dynamic SQL SET clause from a field map. Serializes arrays/objects as JSON. */
export function buildUpdateSets(
  fields: Record<string, unknown>,
): { sets: string[]; values: unknown[] } {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(
        typeof value === "object" && value !== null ? JSON.stringify(value) : value,
      );
    }
  }
  return { sets, values };
}

/** Recompute denormalized feature counts on the project row. */
export function updateDenormalized(dm: DbManager): void {
  const db = dm.getDb();
  const counts = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
      FROM features`,
    )
    .get() as { total: number; completed: number; blocked: number };

  db.prepare(
    `UPDATE project SET total_features = ?, completed_features = ?, blocked_features = ?, updated_at = ?
     WHERE id = 1`,
  ).run(counts.total, counts.completed, counts.blocked, now());
}

/** Enforce FIFO cap on the errors table. */
export function fifoErrors(dm: DbManager): void {
  const db = dm.getDb();
  const maxEntries = dm.getConfigInt("max_error_entries", DEFAULT_MAX_ERROR_ENTRIES);
  const count = (
    db.prepare("SELECT COUNT(*) as cnt FROM errors").get() as { cnt: number }
  ).cnt;
  if (count > maxEntries) {
    db.prepare(
      "DELETE FROM errors WHERE id IN (SELECT id FROM errors ORDER BY id ASC LIMIT ?)",
    ).run(count - maxEntries);
  }
}

/** Read all config as a key/value record. */
export function getAllConfig(dm: DbManager): Record<string, string> {
  const db = dm.getDb();
  const rows = db.prepare("SELECT key, value FROM config").all() as Array<{
    key: string;
    value: string;
  }>;
  const config: Record<string, string> = {};
  for (const r of rows) config[r.key] = r.value;
  return config;
}

/** Build the CLAUDE.md state block. */
export function buildStateBlock(p: ProjectRow): string {
  const inProgress = p.current_feature ? ` | Current: ${p.current_feature}` : "";
  return `Phase: ${p.phase} | Progress: ${p.completed_features}/${p.total_features}${inProgress}`;
}

/** Read recent conventions and errors (used by recovery + next_task composite). */
export function getConventionsAndErrors(dm: DbManager): {
  conventions: Array<{ name: string; from: string; patterns: string[] }>;
  recent_errors: Array<{
    feature_code: string;
    category: string;
    error: string;
    resolution?: string;
    lesson: string;
  }>;
  error_stats: Record<string, number>;
} {
  const db = dm.getDb();

  const convRows = db
    .prepare(
      "SELECT feature_code, name, patterns FROM conventions ORDER BY id DESC LIMIT 15",
    )
    .all() as Array<{ feature_code: string; name: string; patterns: string }>;
  const conventions = convRows.reverse().map((c) => ({
    name: c.name,
    from: c.feature_code,
    patterns: JSON.parse(c.patterns),
  }));

  const errorRows = db
    .prepare(
      "SELECT feature_code, category, error, resolution, lesson FROM errors ORDER BY id DESC LIMIT 5",
    )
    .all() as Array<{
    feature_code: string;
    category: string;
    error: string;
    resolution: string;
    lesson: string;
  }>;

  const statRows = db
    .prepare("SELECT category, COUNT(*) as cnt FROM errors GROUP BY category")
    .all() as Array<{ category: string; cnt: number }>;
  const errorStats: Record<string, number> = {};
  for (const r of statRows) errorStats[r.category] = r.cnt;

  return { conventions, recent_errors: errorRows, error_stats: errorStats };
}

/** Auto-increment the next available code for a table. */
export function nextAvailableCode(dm: DbManager, prefix: string, table: string): string {
  const db = dm.getDb();
  const pattern = `${prefix}%`;
  const row = db
    .prepare(`SELECT code FROM ${table} WHERE code LIKE ? ORDER BY code DESC LIMIT 1`)
    .get(pattern) as { code: string } | undefined;
  if (!row) return `${prefix}001`;
  const num = parseInt(row.code.replace(prefix, ""), 10);
  const next = num + 1;
  return next > 999 ? `${prefix}${next}` : `${prefix}${String(next).padStart(3, "0")}`;
}
