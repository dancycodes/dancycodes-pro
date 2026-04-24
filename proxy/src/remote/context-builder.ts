/**
 * Utilities that read local SQLite and shape it into the payloads the engine expects.
 */

import type { DbManager } from "../db.js";
import type { FeatureRow, QaRow, FixRow, ProjectRow } from "../helpers.js";
import { getAllConfig, getConventionsAndErrors } from "../helpers.js";

export interface FeatureForEngine {
  code: string;
  name: string;
  module: string | null;
  priority: string;
  type: string;
  precedence: string[];
  status: string;
  constraints?: unknown;
  spec_data?: unknown;
  sort_order: number;
}

export function rowToFeatureCtx(f: FeatureRow): FeatureForEngine {
  return {
    code: f.code,
    name: f.name,
    module: f.module,
    priority: f.priority,
    type: f.type,
    precedence: JSON.parse(f.precedence),
    status: f.status,
    constraints: JSON.parse(f.constraints),
    spec_data: f.spec_data ? JSON.parse(f.spec_data) : null,
    sort_order: f.sort_order,
  };
}

export function rowToQaCtx(q: QaRow): {
  code: string;
  name: string;
  category: string;
  priority: string;
  covers_features: string[];
  precedence: string[];
  status: string;
  constraints?: unknown;
  spec_data?: unknown;
  sort_order: number;
} {
  return {
    code: q.code,
    name: q.name,
    category: q.category,
    priority: q.priority,
    covers_features: JSON.parse(q.covers_features),
    precedence: JSON.parse(q.precedence),
    status: q.status,
    constraints: JSON.parse(q.constraints),
    spec_data: q.spec_data ? JSON.parse(q.spec_data) : null,
    sort_order: q.sort_order,
  };
}

export function rowToFixCtx(f: FixRow): {
  code: string;
  bug_id: number | null;
  name: string;
  severity: string;
  affected_features: string[];
  dependency_impact: string[];
  status: string;
  constraints?: unknown;
  spec_data?: unknown;
  sort_order: number;
} {
  return {
    code: f.code,
    bug_id: f.bug_id,
    name: f.name,
    severity: f.severity,
    affected_features: JSON.parse(f.affected_features),
    dependency_impact: JSON.parse(f.dependency_impact),
    status: f.status,
    constraints: JSON.parse(f.constraints),
    spec_data: f.spec_data ? JSON.parse(f.spec_data) : null,
    sort_order: f.sort_order,
  };
}

export function rowToProjectSummary(p: ProjectRow) {
  return {
    name: p.name,
    description: p.description,
    phase: p.phase,
    tech_stack: JSON.parse(p.tech_stack),
    ai_stack: JSON.parse(p.ai_stack),
    excluded_tech: JSON.parse(p.excluded_tech) as string[],
    reactivity_framework: p.reactivity_framework,
    current_feature: p.current_feature,
    current_action: p.current_action,
    total_features: p.total_features,
    completed_features: p.completed_features,
    blocked_features: p.blocked_features,
  };
}

export function readAllFeatures(dm: DbManager): FeatureForEngine[] {
  const db = dm.getDb();
  const rows = db
    .prepare(
      "SELECT code, name, module, priority, type, precedence, status, constraints, spec_data, sort_order, started_at, completed_at FROM features ORDER BY sort_order, code",
    )
    .all() as FeatureRow[];
  return rows.map(rowToFeatureCtx);
}

export function readProjectState(dm: DbManager): {
  project: ProjectRow | null;
  recovery: {
    last_feature: string | null;
    last_action: string | null;
    context_snapshot: string | null;
    updated_at: string | null;
  };
  conventions: ReturnType<typeof getConventionsAndErrors>["conventions"];
  recent_errors: ReturnType<typeof getConventionsAndErrors>["recent_errors"];
  error_stats: Record<string, number>;
  config: Record<string, string>;
} {
  const db = dm.getDb();
  const project = db.prepare("SELECT * FROM project WHERE id = 1").get() as
    | ProjectRow
    | undefined;
  const recovery = (db
    .prepare(
      "SELECT last_feature, last_action, context_snapshot, updated_at FROM recovery WHERE id = 1",
    )
    .get() as
    | {
        last_feature: string | null;
        last_action: string | null;
        context_snapshot: string | null;
        updated_at: string | null;
      }
    | undefined) ?? {
    last_feature: null,
    last_action: null,
    context_snapshot: null,
    updated_at: null,
  };
  const { conventions, recent_errors, error_stats } = getConventionsAndErrors(dm);
  return {
    project: project ?? null,
    recovery,
    conventions,
    recent_errors,
    error_stats,
    config: getAllConfig(dm),
  };
}
