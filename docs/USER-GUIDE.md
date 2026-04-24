# DancyCodes Pro — User Guide

**Install once on any fresh computer. Spec, implement, and ship software projects at a level of quality that matches senior consulting agencies.**

This guide walks you from zero → first project spec → running implementation, on a brand-new machine with nothing installed.

---

## Table of Contents

1. [What You're Getting](#what-youre-getting)
2. [Requirements](#requirements)
3. [Install: One-time Setup (new computer)](#install-one-time-setup-new-computer)
4. [Install: Per-project Setup](#install-per-project-setup)
5. [Your First Project: Spec Mode](#your-first-project-spec-mode)
6. [After the Spec: Implementation Mode](#after-the-spec-implementation-mode)
7. [After Implementation: QA + Fix Mode](#after-implementation-qa--fix-mode)
8. [Resuming a Project](#resuming-a-project)
9. [Troubleshooting](#troubleshooting)
10. [Uninstalling / Moving to Another Computer](#uninstalling--moving-to-another-computer)
11. [Pricing & Licenses](#pricing--licenses)
12. [Support](#support)

---

## What You're Getting

When you install DancyCodes Pro, Claude Code gains:

- **1 skill**: `dancycodes` — orchestrates the full workflow
- **4 agents**: `dc-orchestrator`, `dc-executor`, `dc-evaluator`, `dc-qa` — the delivery pipeline
- **42+ MCP tools** exposed by `@dancycodesorg/dd-manager-proxy`:
  - 30 local CRUD tools (features, QA specs, bugs, fixes, conventions, errors, etc.)
  - 8 proprietary algorithm tools (topological sort, Levenshtein dedup, composite recovery, eligibility ranking) forwarded to the DancyCodes engine
  - 4 methodology tools (`dc_load_phase`, `dc_transition_phase`, `dc_get_reference`, `dc_list_references`)
- **5 phase methodology** on the engine: Interview (3,500 tokens) · State Setup · Generation (18 steps) · Validation · Review
- **19 full reference guides** (feature-file-guide, orchestrator-guide, ui-skill-generation-guide, stitch-mapping, stack-native-generation-guide, etc.)

One license. One `/plugin install` command. Works on every project you build.

---

## Requirements

### Hardware / OS
- Any OS (Windows / macOS / Linux / WSL2)
- Stable internet (the engine runs on Cloudflare Workers — low latency globally)
- 500MB disk for npm + Node toolchain

### Software (install in order)

| Tool | Purpose | Install Command / Link |
|---|---|---|
| **Node.js 20+** | Runtime for the proxy MCP | [nodejs.org](https://nodejs.org/) — download LTS installer |
| **Git** | Used by the orchestrator for feature branches | [git-scm.com](https://git-scm.com/downloads) |
| **Claude Code** | The plugin host | [claude.com/download](https://claude.com/download) |

### Claude Code skills & MCPs (required before first use)

These are installed separately into Claude Code. You'll be prompted if any are missing.

| Dependency | Why | Install |
|---|---|---|
| `skill-creator` skill (Anthropic) | Generates the project-specs skill at the end of Phase 3 | Pre-bundled with Claude Code on most setups; verify via `/skill` |
| `find-skills` skill (Anthropic) | Discovers stack-specific skills during skill curation | Pre-bundled; verify via `/skill` |
| `playwright` MCP (Microsoft) | Required for browser testing during implementation | Add to `~/.claude.json` (see below) |

### Recommended (optional — unlocks Tier 1 UI quality)

| Dependency | Why |
|---|---|
| `stitch` MCP (Google) | Generates Tier 1 UI design tokens from Figma/Stitch screens — the highest-quality UI tier |

If Stitch is not available, the plugin automatically offers Tier 2 (ui-designer skill), Tier 3 (Claude design research), or Tier 4 (bring-your-own).

---

## Install: One-time Setup (new computer)

Do these **once** per computer. After that, every new project reuses the setup.

### Step 1: Install Node.js + Git + Claude Code

Download and install each from the links above. Verify in a terminal:

```bash
node --version      # should print v20.x or higher
npm --version       # should print 10.x or higher
git --version       # should print 2.x
```

### Step 2: Add the Playwright MCP to Claude Code

Edit `~/.claude.json` (Windows: `%USERPROFILE%\.claude.json`, macOS/Linux: `~/.claude.json`). Add under `mcpServers`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Restart Claude Code. Type `/mcp` — you should see `playwright` listed as `connected`.

### Step 3: (Optional) Add the Stitch MCP

If you want Tier 1 UI quality, also add Stitch. Follow Stitch's own install docs (requires a Google account with Stitch access).

### Step 4: Get a DancyCodes Pro license key

**Free beta**: email `dancycodes@gmail.com` — you'll receive a `DCP-XXXXXXXX-XXXXXXXX` key within a few hours.

**Paid plans**: buy via the LemonSqueezy product page (link pending — check https://dancycodes.com). The key is auto-emailed to you the moment payment completes.

Save this key in a password manager. You'll paste it during plugin install.

### Step 5: Install the DancyCodes Pro plugin

In any Claude Code session:

```
/plugin marketplace add https://github.com/dancycodes/dancycodes-pro
/plugin install dancycodes-pro
```

You'll be prompted for:
- **License Key** (required): paste your `DCP-XXXXXXXX-XXXXXXXX` key
- **Engine URL** (optional): just press Enter (uses default)

Claude Code will store the license key securely in your system keychain. You won't need to re-enter it on this machine.

### Step 6: Verify installation

Restart Claude Code (close and reopen). Then in any session, type:

```
/mcp
```

You should see `plugin:dancycodes-pro:dd-manager-proxy` listed as `connected`. If it says `failed`, see [Troubleshooting](#troubleshooting).

You're done with one-time setup. Every new project from now on needs only the 2-step per-project setup below.

---

## Install: Per-project Setup

For each project you want to spec + build:

### Step 1: Create an empty project directory

```bash
mkdir my-awesome-app
cd my-awesome-app
```

### Step 2: Open Claude Code in that directory

Claude Code inherits the working directory. When you invoke DancyCodes, the plugin will:
- Store session state at `./.dancycodes/session.json`
- Store project database at `./.executor/dancydev.db`
- Write the generated spec skill to `./.claude/skills/{project-name}-specs/`
- Write generated agents to `./.claude/agents/`
- Write `./.mcp.json` if missing (or merge into it)
- Write `./CLAUDE.md` content if missing (or inject managed sections)

No further setup needed — the plugin generates everything.

---

## Your First Project: Spec Mode

### Trigger phrases

Any of these invoke the `dancycodes` skill:
- "Spec out my app"
- "Plan my software"
- "Write a spec for [description]"
- "Scope my project"
- "Using dancycodes, build [description]"

### What happens (Phase 1 — Interview & Discovery)

Claude will:

1. **Verify dependencies** — checks that `skill-creator`, `find-skills`, and `playwright` MCP are available.
2. **Round 1 (Orient)** — asks via AskUserQuestion:
   - Project name
   - Project type (e-commerce / SaaS / CRM / todo / other)
   - Target user
   - Primary platform (web / PWA / mobile / desktop)
   - Rough scope hint
3. **Run mandatory research pass** — uses `web_search` to find industry standards for your project type (2 queries for Simple, 4 for Medium, 6+ for Complex). Presents findings to you.
4. **Assess complexity** — Simple (60-100 features) / Medium (80-200) / Complex (200-400). Challenges underestimation if your scope is actually bigger than you think.
5. **Deep probe** via 12 sub-phases (A-L) with research-informed AskUserQuestion options:
   - A Main experience · B Accounts · C CRUD · D Settings · E Search · F Sharing · G Dashboards · H Domain-specific · I Security · J Integrations · K Edge cases · **L Design Identity + UI tier (MANDATORY — you pick Tier 1-4)**
6. **Gap analysis** — compares your chosen scope against industry standards, surfaces missing features so you can knowingly include or exclude.
7. **Scope confirmation** — presents the full feature list, MoSCoW distribution, dependency shape. You approve via AskUserQuestion.
8. **Sub-decomposition audit** — audits each feature against tiered ceilings + INVEST criteria. Splits anything too broad.

All answers save to `./.dancycodes/session.json` after each exchange.

### Phase 2 — State Setup

Claude calls `dc_transition_phase` and formalizes your answers into `session.json` matching a structured schema. Populates:
- `project_name`, `project_type`, `complexity`
- `confirmed_stack` (every layer)
- `scope.feature_catalog` (all features with codes)
- `scope.moscow_distribution` (Must ≤ 60% enforced)
- `design_preferences.ui_tier`

### Phase 3 — Generation Pipeline (18 steps)

Writes everything to disk. Each step is a separate tool call:

| Step | What it produces |
|---|---|
| 1 | Skill folder structure at `.claude/skills/{project}-specs/` |
| 2 | `SKILL.md` (project-specs entry point, feature catalog) |
| 3 | `references/tech-stack.md` |
| 4 | `references/general-concepts.md` |
| 5 | `references/project-claude-md.md` (content for `CLAUDE.md`) |
| 6 | `references/orchestrator-guide.md` (simple/medium/complex variant) |
| 7 | `references/finalizer-guide.md` (8/15/15+module checks) |
| 8 | `.mcp.json` in project root |
| **8.5** | **`.claude/skills/{project}-ui/`** — **INTERACTIVE** UI skill generation per your chosen tier. STOPS if the tier isn't resolvable. |
| 9 | `.claude/agents/executor.md` — stack-native, 300-600 lines |
| 10 | `.claude/agents/qa-agent.md` — stack-native, 200-400 lines |
| 10.5 | `.claude/agents/evaluator.md` — skepticism-tuned, 200-400 lines |
| 11 | **`references/F-001.md` through `F-{N}.md`** — **ONE Write tool call per feature**, per-feature reasoning. No scripts. |
| 12 | Integration check features (one per module) |
| 13 | `references/integration-checkpoints.md` |
| 14 | `references/design-system.md` (if 10+ UI features) |
| 15 | `references/M-{module}.md` per module (if 100+ features) |
| 16 | `references/qa-spec-guide.md` |
| 17 | `references/test-suite-guide.md` |
| 18 | `references/skill-curation-guide.md` |

### Phase 3.5 — Validation

Claude runs a post-generation audit:
- Per-feature: AC/verification/scenarios/BR/edge-case counts vs tiered ceilings
- Cross-feature: catalog integrity, orphaned references, MoSCoW distribution, cycle detection, precedence coverage
- Fix all issues, then proceed.

### Phase 4 — Review & Refinement

Claude presents SKILL.md + sample feature files. You iterate via AskUserQuestion. Final sign-off moves `session.status` to `complete` and archives `spec-state-full.json`.

**Total time for a Medium project (~120 features): typically 60-90 minutes** including your interview answers.

---

## After the Spec: Implementation Mode

The spec is done. Project phase is `skill_curation`. Now you run the orchestrator.

### Trigger phrases
- "Run the orchestrator"
- "Implement features"
- "Continue implementation"
- "Start building"

### What happens

The `dc-orchestrator` agent takes over. It:

1. **Runs prerequisites check**: dd-manager connected, Playwright connected, agents exist, initial features populated.
2. **Skill curation phase** (if not yet done): discovers stack-specific skills via `find-skills`, presents list for approval, installs at project scope.
3. **Enters the feature loop** (feature-by-feature, strictly sequential):

```
LOOP:
  next_task() → next eligible feature
  begin_task(code) → mark in_progress
  git checkout -b feature/F-xxx
  spawn dc-executor (foreground)
  executor submits sprint_contract → orchestrator approves/rejects
  executor implements + tests
  spawn dc-evaluator (foreground, fresh context)
  evaluator verdict: pass | needs_fix | reject
    pass → finish_task, git merge, next feature
    needs_fix → spawn new executor to fix (max 3 rounds)
    reject → block_task, surface to you
  module boundary? → dc-qa module_sweep, fix any bugs (max 1 cycle)
  progress report every 5 features (Simple) / 10 (Medium+)
```

4. **Compaction-resilient**: if Claude's context hits the compaction limit mid-loop, the orchestrator calls `recover()` + reads `orchestrator-context.md` and resumes seamlessly.

**Total time for implementation varies by feature count**: plan for ~10-30 minutes per feature. A 100-feature project takes a long multi-session effort — the orchestrator is designed to run autonomously in the background while you work on other things.

### What YOU see during implementation

- Short progress updates from the orchestrator every 5-10 features
- AskUserQuestion prompts only when genuinely needed (blocked feature, ambiguous amendment)
- Each feature's commit pushed to its own branch, then merged to main on evaluator approval

### Stopping + Resuming

Close Claude Code anytime — state is in SQLite + `orchestrator-context.md`. Reopen, type "continue", and the orchestrator picks up from where it left off.

---

## After Implementation: QA + Fix Mode

When all features are `done` or permanently `blocked`, the orchestrator transitions phase to `test_suite` and signals completion.

### Full QA sweep

Trigger: "Run the QA sweep" or "Run full QA".

The `dc-qa` agent in `full_sweep` mode:
- Loops through every generated QA spec across 12 categories (user_journey, cross_module, role_switching, edge_cases, responsive, dark_mode, error_states, performance, accessibility, localization, console_errors, security_gates)
- Runs each via Playwright MCP at both desktop (1280x800) and mobile (375x667) viewports
- Records bugs with severity (critical/major/minor/cosmetic)

### Fix phase

Trigger: "Continue with the fix phase" or "Fix the bugs".

The orchestrator:
1. Generates FIX-xxx.md specs from each open bug
2. Processes fixes severity-ordered (critical first)
3. Spawns dc-executor in fix mode per fix spec
4. Runs dependency-aware regression checklist after each fix
5. Auto-transitions bugs to `fixed` status

### Finalizer

After QA + fixes, run the finalizer: "Finalize the project" or "Run production readiness check".

Simple projects: 8 critical checks. Medium: standard 15 checks. Complex: 15 + module-level audit + architecture proposals.

Outputs `FINAL-QUALITY-REPORT.md` — your ship-readiness signal.

### Permanent test suite

When the finalizer passes, the orchestrator transitions phase to `complete` and generates the permanent framework test suite (Pest/Jest/pytest). These are the tests CI runs forever after.

---

## Resuming a Project

Come back next week to a project mid-implementation? Just:

1. Open Claude Code in the project directory.
2. Type: **"continue"** or **"resume"** or **"where were we"**.

The plugin:
- Reads `./.dancycodes/session.json` if the project is in a spec phase
- Calls `recover()` via dd-manager-proxy if the project is in implementing/qa/fix/test_suite phase
- Tells you exactly where you are + what the next action is
- Resumes the appropriate loop (orchestrator, QA agent, fix loop, test generation)

Everything is checkpointed. You can interrupt and resume at any feature boundary with zero data loss.

---

## Troubleshooting

### `/mcp` shows `plugin:dancycodes-pro:dd-manager-proxy` as `failed`

Check in order:

1. **License key missing or wrong**
   - Uninstall: `/plugin uninstall dancycodes-pro`
   - Reinstall: `/plugin install dancycodes-pro`
   - Re-enter the correct key when prompted.

2. **npx can't install the proxy**
   - Run manually: `npx -y @dancycodesorg/dd-manager-proxy` (just press Ctrl+C after it says "Connected via stdio")
   - If this fails, you have a Node.js / npm problem, not a plugin problem. Reinstall Node.js.

3. **Firewall blocking Cloudflare Workers**
   - Test: `curl https://dancycodes-engine.dancycodes.workers.dev/health`
   - Should return `{"status":"ok","db":"ok"}`.
   - If it fails, your network blocks `*.workers.dev` — whitelist it.

4. **License expired or revoked**
   - Test the key directly:
     ```bash
     curl -X POST https://dancycodes-engine.dancycodes.workers.dev/mcp \
       -H "Content-Type: application/json" \
       -H "Accept: application/json, text/event-stream" \
       -H "X-License-Key: YOUR-KEY" \
       -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
     ```
   - HTTP 403 → license revoked. Contact support.
   - HTTP 401 → key is malformed. Use the value from your purchase/beta email exactly.

### Claude skips the research pass or AskUserQuestion

Claude Code needs to have loaded the plugin's SKILL.md in the current session. If it's not behaving:

```
/reload-plugins
```

Then trigger the skill again with "spec out my app".

### "Playwright MCP not connected" block

The plugin requires Playwright for any feature using the `playwright` testing strategy. Set it up once per machine (see [Step 2 of One-time Setup](#step-2-add-the-playwright-mcp-to-claude-code)).

### "Stitch MCP not connected" during Phase 3 Step 8.5

If you picked Tier 1 UI in the interview but Stitch isn't responding, the plugin STOPS and offers you 3 alternatives via AskUserQuestion:
- Reconnect Stitch and retry
- Switch to Tier 2 (ui-designer skill)
- Switch to Tier 3 (Claude design research)

This is by design — the UI skill is load-bearing, so the plugin refuses to silently downgrade.

### Orchestrator stops mid-loop

Most common causes:
- Context compaction mid-feature — just say "continue", the orchestrator resumes via `recover()`.
- Playwright MCP lost connection — restart Claude Code, then "continue".
- Sprint contract exhausted revision rounds (default: 2) — orchestrator escalates to you. Review the rejected plan, adjust scope or constraints, resume.

---

## Uninstalling / Moving to Another Computer

### Uninstall the plugin

```
/plugin uninstall dancycodes-pro
/plugin marketplace remove dancycodes-pro-marketplace
```

Your project data (`./.dancycodes/`, `./.executor/`, `./.claude/skills/{project}-specs/`) stays in your project directory, untouched.

### Move a project to another computer

1. Copy the project directory (including `.dancycodes/`, `.executor/`, `.claude/`, source code, everything) to the new machine.
2. Install DancyCodes Pro on the new machine (one-time setup above).
3. Open Claude Code in the copied directory.
4. Say "continue".

The plugin reads the existing state and resumes. No migration needed.

### Move your license to another computer

Licenses are not machine-locked. Install the plugin on up to 5 computers per license (approximate — subject to abuse detection). If you exceed, your license may be auto-revoked; contact support.

---

## Pricing & Licenses

### v0.1 Free Beta (current)

Get a free license by emailing `dancycodes@gmail.com`. Expect a reply within 24 hours (usually faster). Plan: `agency` for free beta testers — unlimited projects.

### Post-beta pricing (coming soon)

| Tier | Price | What you get |
|---|---|---|
| Community | Free | 1 active project, all core features |
| Pro | $29 one-time OR $12/mo | Unlimited projects |
| Team | $49/seat | Team license, shared license management |
| Agency | $199 | Unlimited seats, priority support, custom methodology tuning |

Payments via [LemonSqueezy](https://lemonsqueezy.com) (merchant of record handles global tax). Auto-issued licenses land in your inbox seconds after purchase.

### What counts as an "active project"?

Any project directory where you've run `init_project` via the plugin. Idle projects don't count against your limit. Community users can archive old projects and start new ones freely.

### Data privacy

- **Your project data NEVER leaves your machine.** SQLite is local (`./.executor/dancydev.db`).
- The engine receives ONLY: your license key + tool name + session hash + timestamp on each call. No code, no features, no bugs, no spec content.
- When proprietary algorithms need input (e.g., `dd_process_next_task`), the minimal required subset of your local state is sent per-call, processed, and immediately discarded by the engine — not stored.

---

## Support

- **Issues / bug reports**: https://github.com/dancycodes/dancycodes-pro/issues
- **Email**: dancycodes@gmail.com
- **License questions**: include your license key prefix (first 8 chars) in the email

---

## Appendix: Full Command Reference

### Trigger phrases

| Phrase | What happens |
|---|---|
| "Spec out my app" / "Plan my software" | Starts Phase 1 interview |
| "Continue" / "Resume" / "Where were we" | Resumes the project from wherever you left off |
| "Run the orchestrator" / "Implement features" | Starts the autonomous feature loop |
| "Run skill curation" | Runs the skill curation phase manually |
| "Run the QA sweep" | Full end-to-end QA via dc-qa |
| "Continue with the fix phase" | Processes open bugs severity-ordered |
| "Finalize the project" / "Run production readiness" | Runs the finalizer |
| "Generate client document" | Produces a non-technical client-facing summary |

### Slash commands (Claude Code built-ins you'll use)

| Command | What it does |
|---|---|
| `/mcp` | Shows MCP server status (check `dd-manager-proxy` is connected) |
| `/plugin install dancycodes-pro` | Install the plugin |
| `/plugin uninstall dancycodes-pro` | Uninstall |
| `/reload-plugins` | Reload after an update |
| `/plugin marketplace add https://github.com/dancycodes/dancycodes-pro` | Register the marketplace |

### Files the plugin creates in your project

```
my-project/
├── .mcp.json                              MCP server declarations (dd-manager-proxy + playwright)
├── CLAUDE.md                              Project context (tech stack, standards, spec skill reference)
├── .dancycodes/session.json               Current session state (interview progress)
├── .executor/dancydev.db                  SQLite project state (features, QA, bugs, fixes, metrics)
├── .executor/orchestrator-context.md      Compaction-resilience recovery context
└── .claude/
    ├── agents/
    │   ├── dc-orchestrator.md             (from plugin — thin wrapper)
    │   ├── executor.md                    (generated — stack-native, 300-600 lines)
    │   ├── evaluator.md                   (generated — 200-400 lines)
    │   └── qa-agent.md                    (generated — 200-400 lines)
    └── skills/
        ├── {project}-specs/               (generated — your spec skill)
        │   ├── SKILL.md
        │   └── references/
        │       ├── F-001.md … F-{N}.md   (one per feature)
        │       ├── spec-state.json
        │       ├── tech-stack.md
        │       ├── general-concepts.md
        │       ├── project-claude-md.md
        │       ├── orchestrator-guide.md
        │       ├── finalizer-guide.md
        │       ├── integration-checkpoints.md
        │       ├── qa-spec-guide.md
        │       ├── test-suite-guide.md
        │       └── skill-curation-guide.md
        ├── {project}-ui/                  (generated — your project's UI design system)
        │   ├── SKILL.md
        │   ├── theme.css
        │   └── references/
        │       ├── components.md
        │       ├── layouts.md
        │       └── brand.md
        └── {project}-specs-archive/
            └── spec-state-full.json       (complete decision history, archived)
```

---

*Last updated: 2026-04-24 — v0.1.0 free beta*
*Copyright (c) DancyCodes. Licensed use only.*
