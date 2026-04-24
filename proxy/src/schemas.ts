import { z } from "zod";

// =============================================
// Core Enums & Patterns
// =============================================

export const FeatureCodeSchema = z.string().regex(/^F-\d{3,4}$/);
export const QaCodeSchema = z.string().regex(/^QA-\d{3,4}$/);
export const QaOrModuleCodeSchema = z.string().regex(/^(QA-\d{3,4}|MODULE-.+)$/);
export const FixCodeSchema = z.string().regex(/^FIX-\d{3,4}$/);

export const ProjectPhaseSchema = z.enum([
  "specs",
  "skill_curation",
  "implementing",
  "test_suite",
  "complete",
]);

export const PrioritySchema = z.enum(["Must-have", "Should-have", "Could-have", "Wont-have"]);
export const FeatureTypeSchema = z.enum(["foundation", "functional", "edge-case", "polish"]);
export const FeatureStatusSchema = z.enum(["pending", "in_progress", "done", "blocked", "skipped"]);
export const ActionSchema = z.enum(["implementing", "testing", "fixing", "evaluating", "completed"]);

export const ErrorCategorySchema = z.enum([
  "reactivity",
  "ui_design",
  "translation",
  "responsive",
  "permissions",
  "database",
  "business_logic",
  "validation",
  "routing",
  "dependency",
  "testing",
  "infrastructure",
  "other",
]);

export const SpecReviewCategorySchema = z.enum([
  "completeness",
  "dependency",
  "granularity",
  "consistency",
]);

export const SpecReviewStatusSchema = z.enum(["open", "resolved", "accepted"]);
export const TestStrategySchema = z.enum(["playwright", "pest", "both", "none"]);
export const ManageReviewsModeSchema = z.enum(["add", "query"]);
export const SaveFeaturesModeSchema = z.enum(["insert", "update", "upsert"]);
export const BugSeveritySchema = z.enum(["critical", "major", "minor", "cosmetic"]);
export const BugStatusSchema = z.enum(["open", "fixing", "fixed", "wont_fix"]);

export const QaCategorySchema = z.enum([
  "user_journey",
  "cross_module",
  "role_switching",
  "edge_cases",
  "responsive",
  "dark_mode",
  "error_states",
  "performance",
  "accessibility",
  "localization",
  "console_errors",
  "security_gates",
]);

export const QaResultSchema = z.enum(["pass", "fail", "partial"]);

export const AmendmentTypeSchema = z.enum([
  "spec_correction",
  "missing_requirement",
  "dependency_change",
  "scope_change",
]);

export const AmendmentStatusSchema = z.enum(["pending", "applied", "rejected"]);
export const EvaluationVerdictSchema = z.enum(["pass", "needs_fix", "reject"]);
export const SprintContractStatusSchema = z.enum(["pending", "approved", "rejected", "revised"]);
export const ModuleQaResultSchema = z.enum(["pass", "partial", "fail"]);

// =============================================
// Complex Schemas
// =============================================

export const TechStackItemSchema = z.object({
  name: z.string(),
  role: z.string(),
  version: z.string().optional(),
});

export const AiStackItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  purpose: z.string(),
});

export const ConstraintsSchema = z.object({
  skills: z.array(z.string()).default([]),
  instructions: z.array(z.string()).default([]),
  test_strategy: TestStrategySchema.default("playwright"),
  regression_check: z.array(FeatureCodeSchema).default([]),
});

export const ScenarioSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()),
  expected_outcome: z.string(),
  user_feedback: z.string().optional(),
});

export const BusinessRuleSchema = z.object({
  code: z.string(),
  rule: z.string(),
});

export const EdgeCaseSchema = z.object({
  condition: z.string(),
  expected: z.string(),
});

export const UserInteractionSchema = z.object({
  role: z.string(),
  interaction: z.string(),
});

export const RelatedFeatureSchema = z.object({
  code: z.string(),
  relationship: z.string(),
});

export const DataInvolvedSchema = z.object({
  creates: z.array(z.string()).default([]),
  reads: z.array(z.string()).default([]),
  updates: z.array(z.string()).default([]),
  relationships: z.array(z.string()).default([]),
});

export const SpecDataSchema = z.object({
  what_it_does: z.string(),
  who_uses_it: z.array(UserInteractionSchema).default([]),
  scenarios: z.array(ScenarioSchema).default([]),
  business_rules: z.array(BusinessRuleSchema).default([]),
  acceptance_criteria: z.array(z.string()).default([]),
  verification_steps: z.array(z.string()).default([]),
  edge_cases: z.array(EdgeCaseSchema).default([]),
  data_involved: DataInvolvedSchema.optional(),
  ui_ux_notes: z.string().optional(),
  related_features: z.array(RelatedFeatureSchema).default([]),
});

export const QaSpecDataSchema = z.object({
  what_it_tests: z.string(),
  test_scenarios: z
    .array(
      z.object({
        name: z.string(),
        steps: z.array(z.string()),
        expected_behavior: z.string(),
      }),
    )
    .default([]),
  pass_fail_criteria: z.array(z.string()).default([]),
});

export const FixSpecDataSchema = z.object({
  bug_description: z.string(),
  steps_to_reproduce: z.array(z.string()).default([]),
  expected_behavior: z.string(),
  root_cause_hints: z.string().optional(),
  fix_scope: z.array(z.string()).default([]),
  verification_steps: z.array(z.string()).default([]),
  regression_checklist: z.array(z.string()).default([]),
});

export const FeatureMetricsSchema = z.object({
  eval_rounds: z.number().int().default(0),
  fix_retries: z.number().int().default(0),
  wall_time_seconds: z.number().int().optional(),
  sprint_contract_revisions: z.number().int().default(0),
  evaluator_issues_found: z.number().int().default(0),
  evaluator_issues_fixed: z.number().int().default(0),
});

// =============================================
// Constants — defaults for the config table
// =============================================

export const DEFAULT_MAX_ERROR_ENTRIES = 50;
export const DEFAULT_MAX_FIX_RETRIES = 5;
export const DEFAULT_MAX_EVAL_ROUNDS = 3;
export const DEFAULT_MODULE_QA_FIX_CYCLES = 1;
export const DEFAULT_SPRINT_CONTRACT_REVISIONS = 2;
