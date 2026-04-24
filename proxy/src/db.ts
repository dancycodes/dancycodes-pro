import Database from "better-sqlite3";
import path from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  DEFAULT_MAX_ERROR_ENTRIES,
  DEFAULT_MAX_FIX_RETRIES,
  DEFAULT_MAX_EVAL_ROUNDS,
  DEFAULT_MODULE_QA_FIX_CYCLES,
  DEFAULT_SPRINT_CONTRACT_REVISIONS,
} from "./schemas.js";

/**
 * DbManager owns the local SQLite database at {DD_DIR}/dancydev.db.
 * Schema is intentionally identical to the legacy dd-manager schema so
 * existing databases migrate without data loss.
 */
export class DbManager {
  private dbPath: string;
  private db: Database.Database | null = null;
  readonly ddDir: string;

  constructor(ddDir: string) {
    this.ddDir = ddDir;
    this.dbPath = path.join(ddDir, "dancydev.db");
  }

  ensureDir(): void {
    mkdirSync(this.ddDir, { recursive: true });
  }

  getDb(): Database.Database {
    if (this.db) return this.db;
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    return this.db;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  initDb(): void {
    this.ensureDir();
    const db = this.getDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS project (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        name TEXT NOT NULL,
        description TEXT,
        phase TEXT NOT NULL DEFAULT 'specs'
          CHECK(phase IN ('specs', 'skill_curation', 'implementing', 'test_suite', 'complete')),
        tech_stack TEXT NOT NULL DEFAULT '[]',
        ai_stack TEXT NOT NULL DEFAULT '[]',
        excluded_tech TEXT NOT NULL DEFAULT '[]',
        general_concepts TEXT,
        reactivity_rules TEXT,
        reactivity_framework TEXT,
        claude_md_content TEXT,
        spec_state TEXT,
        intelligence_briefing TEXT,
        total_features INTEGER NOT NULL DEFAULT 0,
        completed_features INTEGER NOT NULL DEFAULT 0,
        blocked_features INTEGER NOT NULL DEFAULT 0,
        current_feature TEXT,
        current_action TEXT
          CHECK(current_action IS NULL OR current_action IN ('implementing', 'testing', 'fixing', 'evaluating', 'completed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS features (
        code TEXT PRIMARY KEY CHECK(code GLOB 'F-[0-9][0-9][0-9]*'),
        name TEXT NOT NULL,
        module TEXT,
        priority TEXT NOT NULL
          CHECK(priority IN ('Must-have', 'Should-have', 'Could-have', 'Wont-have')),
        type TEXT NOT NULL DEFAULT 'functional'
          CHECK(type IN ('foundation', 'functional', 'edge-case', 'polish')),
        precedence TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'in_progress', 'done', 'blocked', 'skipped')),
        constraints TEXT NOT NULL DEFAULT '{"skills":[],"instructions":[],"test_strategy":"playwright","regression_check":[]}',
        spec_data TEXT,
        implementation_summary TEXT,
        key_files TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_code TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN (
          'reactivity', 'ui_design', 'translation', 'responsive',
          'permissions', 'database', 'business_logic', 'validation',
          'routing', 'dependency', 'testing', 'infrastructure', 'other'
        )),
        error TEXT NOT NULL,
        resolution TEXT NOT NULL,
        lesson TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conventions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_code TEXT NOT NULL,
        name TEXT NOT NULL,
        patterns TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS recovery (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        last_feature TEXT,
        last_action TEXT,
        context_snapshot TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS spec_review (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_round INTEGER NOT NULL,
        category TEXT NOT NULL CHECK(category IN (
          'completeness', 'dependency', 'granularity', 'consistency'
        )),
        finding TEXT NOT NULL,
        resolution TEXT,
        status TEXT NOT NULL DEFAULT 'open'
          CHECK(status IN ('open', 'resolved', 'accepted'))
      );

      CREATE TABLE IF NOT EXISTS qa_specs (
        code TEXT PRIMARY KEY CHECK(code GLOB 'QA-[0-9][0-9][0-9]*'),
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN (
          'user_journey', 'cross_module', 'role_switching', 'edge_cases',
          'responsive', 'dark_mode', 'error_states', 'performance',
          'accessibility', 'localization', 'console_errors', 'security_gates'
        )),
        priority TEXT NOT NULL
          CHECK(priority IN ('Must-have', 'Should-have', 'Could-have', 'Wont-have')),
        covers_features TEXT NOT NULL DEFAULT '[]',
        precedence TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'in_progress', 'done', 'blocked', 'skipped')),
        constraints TEXT NOT NULL DEFAULT '{"skills":[],"instructions":[],"test_strategy":"playwright","regression_check":[]}',
        spec_data TEXT,
        result TEXT CHECK(result IS NULL OR result IN ('pass', 'fail', 'partial')),
        findings TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS bugs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        qa_code TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('critical', 'major', 'minor', 'cosmetic')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        steps_to_reproduce TEXT NOT NULL,
        expected_behavior TEXT NOT NULL,
        actual_behavior TEXT NOT NULL,
        affected_features TEXT NOT NULL DEFAULT '[]',
        fix_code TEXT,
        status TEXT NOT NULL DEFAULT 'open'
          CHECK(status IN ('open', 'fixing', 'fixed', 'wont_fix')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS fix_specs (
        code TEXT PRIMARY KEY CHECK(code GLOB 'FIX-[0-9][0-9][0-9]*'),
        bug_id INTEGER REFERENCES bugs(id),
        name TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('critical', 'major', 'minor', 'cosmetic')),
        affected_features TEXT NOT NULL DEFAULT '[]',
        dependency_impact TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'in_progress', 'done', 'blocked', 'skipped')),
        constraints TEXT NOT NULL DEFAULT '{"skills":[],"instructions":[],"test_strategy":"playwright","regression_check":[]}',
        spec_data TEXT,
        implementation_summary TEXT,
        key_files TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS amendments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_code TEXT NOT NULL,
        amendment_type TEXT NOT NULL CHECK(amendment_type IN (
          'spec_correction', 'missing_requirement', 'dependency_change', 'scope_change'
        )),
        original_spec TEXT NOT NULL,
        corrected_behavior TEXT NOT NULL,
        discovered_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'applied', 'rejected')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS feature_metrics (
        feature_code TEXT PRIMARY KEY,
        eval_rounds INTEGER NOT NULL DEFAULT 0,
        fix_retries INTEGER NOT NULL DEFAULT 0,
        wall_time_seconds INTEGER,
        sprint_contract_revisions INTEGER NOT NULL DEFAULT 0,
        evaluator_issues_found INTEGER NOT NULL DEFAULT 0,
        evaluator_issues_fixed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_code TEXT NOT NULL,
        round INTEGER NOT NULL DEFAULT 1,
        verdict TEXT NOT NULL CHECK(verdict IN ('pass', 'needs_fix', 'reject')),
        issues TEXT NOT NULL DEFAULT '[]',
        fixed_issues TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sprint_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature_code TEXT NOT NULL,
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'approved', 'rejected', 'revised')),
        feedback TEXT,
        revision INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS module_qa_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module TEXT NOT NULL,
        features_tested TEXT NOT NULL DEFAULT '[]',
        bugs_found INTEGER NOT NULL DEFAULT 0,
        bugs_fixed INTEGER NOT NULL DEFAULT 0,
        result TEXT NOT NULL CHECK(result IN ('pass', 'partial', 'fail')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.prepare(`INSERT OR IGNORE INTO recovery (id, updated_at) VALUES (1, datetime('now'))`).run();

    const seed = db.prepare(
      `INSERT OR IGNORE INTO config (key, value, description, updated_at) VALUES (?, ?, ?, datetime('now'))`,
    );
    seed.run("max_fix_retries", String(DEFAULT_MAX_FIX_RETRIES), "Maximum fix-and-retest iterations per feature");
    seed.run("max_eval_rounds", String(DEFAULT_MAX_EVAL_ROUNDS), "Maximum evaluator loop iterations per feature");
    seed.run("max_error_entries", String(DEFAULT_MAX_ERROR_ENTRIES), "FIFO cap on error journal entries");
    seed.run("module_qa_fix_cycles", String(DEFAULT_MODULE_QA_FIX_CYCLES), "Max fix-QA cycles per module boundary sweep");
    seed.run(
      "sprint_contract_revisions",
      String(DEFAULT_SPRINT_CONTRACT_REVISIONS),
      "Max sprint contract revision rounds",
    );
  }

  isInitialized(): boolean {
    if (!existsSync(this.dbPath)) return false;
    const db = this.getDb();
    try {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM project").get() as { cnt: number } | undefined;
      return (row?.cnt ?? 0) > 0;
    } catch {
      return false;
    }
  }

  getProjectRoot(): string {
    return path.dirname(this.ddDir);
  }

  getConfig(key: string, fallback?: string): string {
    const db = this.getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? fallback ?? "";
  }

  getConfigInt(key: string, fallback: number): number {
    const val = this.getConfig(key);
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
  }

  updateClaudeMdState(stateContent: string): void {
    const filePath = path.join(this.getProjectRoot(), "CLAUDE.md");
    if (!existsSync(filePath)) return;

    const marker = "<!-- DANCYDEV:STATE -->";
    const content = readFileSync(filePath, "utf-8");
    const startIdx = content.indexOf(marker);
    if (startIdx === -1) return;

    const endIdx = content.indexOf(marker, startIdx + marker.length);
    if (endIdx === -1) return;

    const before = content.substring(0, startIdx + marker.length);
    const after = content.substring(endIdx);
    writeFileSync(filePath, `${before}\n${stateContent}\n${after}`, "utf-8");
  }
}
