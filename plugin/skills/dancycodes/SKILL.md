---
name: dancycodes
description: >
  DancyCodes Pro — spec-driven software delivery. Use this skill when the user wants to
  plan, spec, document, or scope a software project, OR when they want to implement features
  from an existing DancyCodes spec. Trigger phrases: "spec out my app", "plan my software",
  "write a spec", "scope my project", "implement features", "run the orchestrator",
  "dancycodes", "dancyskill".
---

# DancyCodes Pro — Specification & Delivery Skill

This skill orchestrates the complete DancyCodes workflow: interview, decomposition,
generation, implementation, QA, and completion. All proprietary methodology is
delivered on-demand from the DancyCodes engine — this local skill is just a thin
router.

## Required Dependencies

Verify these are installed before proceeding. If any are missing, stop and ask the user
to install them.

- **skill-creator** skill (Anthropic) — used during Phase 3 Step 8.5 and the final spec skill generation. Check \`/mnt/skills/examples/skill-creator/SKILL.md\` or \`.claude/skills/skill-creator/\`.
- **find-skills** skill (Anthropic) — used during skill curation to discover stack-specific skills.
- **playwright MCP** (Microsoft) — hard requirement for any feature using Playwright testing strategy. Check the user's \`.mcp.json\`.

**Recommended (not blocking):**
- **stitch MCP** (Google) — enables Tier 1 UI skill generation. Without it, the UI interview offers Tier 2, Tier 3, or Tier 4 alternatives.

## HARD RULES (Apply Throughout)

These rules apply to EVERY interaction. Violating them produces low-quality output.

### Rule 0: Mandatory Research Pass (before sub-phase questions)
**The user knows 10% of what they need. Your job is to reveal the other 90% via research.**

After Round 1 (orient) and BEFORE any deep sub-phase questions:
- Run `web_search` queries per the methodology's required depth:
  - Simple: 2 queries minimum (standard features, common gaps)
  - Medium: 4 queries minimum (standard features, competitors, pitfalls, edge cases)
  - Complex: 6+ queries minimum (all above + compliance, architecture patterns)
- **Present findings to the user** in a structured summary BEFORE asking sub-phase questions. Findings are not for private use — they're the evidence users need to make informed scope decisions.
- **Incorporate findings into AskUserQuestion option descriptions** — every recommended feature should cite the research evidence.
- Before Phase 2 transition, run **Gap Analysis**: compare user's scope vs industry standards, present gaps via AskUserQuestion so user can knowingly accept or exclude.

**Research is MANDATORY even for Simple projects.** Skipping research = spec becomes a checkbox exercise of what the user thought to ask for. Full methodology spec never results.

### Rule 1: Interview interaction uses AskUserQuestion when available
- Detect whether the \`AskUserQuestion\` tool is in your tool list.
- If YES → use it for every structured decision point. One question at a time, with 2-4 options plus "Other". Always mark the best default with "(Recommended)".
- If NO → present numbered plain-text options with a clear recommendation.
- Plain text is acceptable ONLY for genuinely open-ended questions ("Describe your app", "Walk me through a session").
- **AskUserQuestion option descriptions must cite research** — when a feature is recommended, the description should say why ("Industry standard — 9/10 competitors include this per web_search").

### Rule 2: Feature files are written with the Write tool, one per call
- NEVER write a script (Node, Bash, Python) that reads from SQLite and template-expands F-xxx.md files.
- NEVER batch multiple features into a single Write call.
- NEVER use a loop or helper function to mass-produce feature files.
- EACH F-xxx.md gets its own Write tool call preceded by fresh per-feature reasoning: what scenarios does THIS feature have that no other feature has?
- You MAY issue 3-5 Write calls in parallel in a single response — that is efficient. What you may NOT do is generate them from a template.
- If you feel tempted to write a script, STOP. That is the anti-pattern. The methodology's value lives in per-feature reasoning.

### Rule 3: UI skill generation is interactive and blocking
- During Phase 1 Sub-Phase L, ask the user which UI tier they want:
  - **Tier 1: Stitch MCP** (Google design tokens from Figma/Stitch) — Recommended if Stitch MCP connected
  - **Tier 2: ui-designer skill** (user's global design skill) — Recommended if ui-designer installed
  - **Tier 3: Claude design research** (web-research-driven custom design system) — Recommended if neither Stitch nor ui-designer available
  - **Tier 4: User-provided** (bring your own skill path or CSS/docs)
- During Phase 3 Step 8.5, VERIFY the chosen tier actually works. If Stitch MCP fails to respond → STOP, use AskUserQuestion to offer fallback. Do NOT silently downgrade.
- Do NOT proceed past Step 8.5 until \`.claude/skills/{project}-ui/SKILL.md\` exists. Verify with a Read call.

## License & MCP Setup

This skill is powered by the \`dd-manager-proxy\` local MCP declared in the plugin's \`.mcp.json\`. It:
- Hosts SQLite project state at \`{project}/.executor/dancydev.db\`
- Handles 30+ local CRUD tools
- Forwards 8 proprietary-algorithm calls to the DancyCodes engine
- Forwards 4 methodology calls (dc_load_phase, dc_transition_phase, dc_get_reference, dc_list_references) to the engine

The plugin prompts for your license key at install time — stored securely. No environment variable setup required.

Get a free beta license at dancycodes.com or by emailing dancycodes@gmail.com.

## Operating Modes

### Mode A — Specification
Triggered when: user wants to plan/spec/scope a software project.

1. **Verify dependencies** (see Required Dependencies above).
2. **Call \`dc_load_phase({ phase: "interview_intro" })\`** — loads full Phase 1 methodology (~3,500 tokens). Claude prompt-caches this; subsequent calls are near-free.
3. **Follow the methodology returned EXACTLY.** Do not shortcut. Do not skip sub-phases (except as permitted for Simple projects). Use AskUserQuestion throughout.
4. **Record session state locally** in \`.dancycodes/session.json\`. Include: project_name, description, complexity, tech_stack, interview answers by sub-phase, design_preferences (including ui_tier), derived features, approved feature count, open questions.
5. **Transition between phases** via \`dc_transition_phase({ from, to, session_context })\`. The engine returns the next phase's methodology.
6. **Fetch specific references on-demand** via \`dc_get_reference({ name })\`. Currently populated: feature-file-guide, skill-template-guide, orchestrator-guide, general-concepts, mcp-setup-guide, ui-skill-generation-guide.
7. **During Phase 2 (State Setup)**, call \`init_project\`, \`save_features\`, \`compute_sort_order\` via dd-manager-proxy.
8. **During Phase 3 Step 8.5**, generate the project UI skill via \`skill-creator\` per the user's chosen tier. STOP if the tier is not resolvable.
9. **During Phase 3 Step 11**, write each F-xxx.md via the Write tool — per-feature reasoning, no scripts.
10. **At the end of Phase 3**, use \`skill-creator\` to finalize the project-specs skill at \`.claude/skills/{project}-specs/\`.

### Mode B — Implementation
Triggered when: user has a project-specs skill installed and says "implement", "run the orchestrator", "continue feature X".

1. **Call \`recover()\`** (via dd-manager-proxy) — returns composite session state + guidance on what to do next.
2. **Follow the orchestrator protocol.** Fetch via \`dc_get_reference({ name: "orchestrator-guide" })\`.
3. **Loop**: \`next_task\` → read feature spec (from project-specs skill) → spawn executor agent → submit sprint contract → implement → spawn evaluator → handle verdict → \`finish_task\` → repeat.
4. **Never stop the loop** until explicitly blocked or the user interrupts.

### Mode C — QA & Fix
Triggered when: all features are done and user wants the QA sweep, or bugs exist and fixes are needed.

1. **QA phase**: call \`qa_recover()\`, follow QA orchestrator protocol, loop \`next_qa_task\` → execute QA → \`finish_qa_task\` with result.
2. **Fix phase**: loop \`next_fix_task\` (severity-sorted) → implement fix → \`finish_fix_task\`.

## Tool Discipline

- **Never call methodology tools redundantly.** \`dc_load_phase\` returns large content; rely on prompt caching for repeats.
- **Always include copyright + licensing notice** when storing methodology content locally.
- **Report telemetry back to user** when license validation fails so they can renew.
- **Halt immediately** if the DancyCodes engine returns HTTP 401/403.

## Getting Help

- Docs: https://dancycodes.com/docs
- Issues: https://github.com/dancycodes/dancycodes-pro/issues
- Support: dancycodes@gmail.com

---
Copyright (c) DancyCodes. DancyCodes Pro license applies. Redistribution forbidden.
