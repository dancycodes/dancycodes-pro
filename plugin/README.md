# DancyCodes Pro — Claude Code Plugin

Spec-driven software delivery for Claude Code. Interview → spec → implement → QA → complete.

**Free trial license:** Email dancycodes@gmail.com for a test license key while we're in v0.1 beta.

## Installation

### 1. Set your license key

```bash
# Add to your ~/.bashrc, ~/.zshrc, or Windows user env vars
export DANCYCODES_LICENSE_KEY="DCP-XXXXXXXX-XXXXXXXX"
```

### 2. Install required dependencies

DancyCodes Pro orchestrates other skills and MCP servers. You need these installed:

**Required:**
- [skill-creator](https://github.com/anthropics/skills/tree/main/skill-creator) (Anthropic)
- [find-skills](https://github.com/anthropics/skills/tree/main/find-skills) (Anthropic)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) (Microsoft)

**Recommended:**
- [Stitch MCP](https://stitch.tools) (Google) — enables Tier 1 UI skill generation

### 3. Install the plugin

In Claude Code:

```
/plugin marketplace add dancycodes/dancycodes-pro
/plugin install dancycodes-pro
```

Or from a local checkout:

```
/plugin install /path/to/dancycodes-pro/plugin
```

### 4. Install the proxy npm package

The plugin's `.mcp.json` references `@dancycodes/dd-manager-proxy`. It auto-installs on first run via `npx`. No action needed — just make sure `npx` is in your PATH.

## Usage

### Spec out a new project

```
/dancycodes I want to build a SaaS product for managing dental clinics
```

Claude will:
1. Ask you structured questions across 12 sub-phases
2. Research industry standards
3. Derive a feature catalog (60-400 features)
4. Get your confirmation
5. Generate the project-specs skill locally
6. Prepare `.mcp.json`, agents, and scaffolding

### Implement features

Once specs are done:

```
Run the orchestrator
```

Or invoke the orchestrator agent directly. It will loop through features autonomously.

### Run QA

After implementation:

```
Run the QA sweep
```

### Fix bugs

After QA finds bugs:

```
Continue with the fix phase
```

## Architecture

- **Local MCP (`dd-manager-proxy`)** runs on your machine, holds your project's SQLite database at `.executor/dancydev.db`. 30+ CRUD tools.
- **Remote MCP (`dancycodes-engine`)** hosted on Cloudflare Workers. Delivers proprietary methodology on-demand + processes 8 proprietary algorithms (topological sort, Levenshtein dedup, eligibility composition, recovery).
- **No user data leaves your machine.** The engine only receives the minimal context needed to run an algorithm on a given call. All project data stays local.

## Pricing

Currently in **v0.1 free beta**. Test phase — no payments collected. Licenses are issued manually by emailing dancycodes@gmail.com.

Post-beta plans:
- **Community** — Free — 1 active project, full workflow
- **Pro** — $29 one-time or $12/mo — unlimited projects
- **Team** — $49/seat — team license
- **Agency** — $199 — unlimited seats, priority support

## Troubleshooting

### "License key required"
Ensure `DANCYCODES_LICENSE_KEY` is set in your environment before launching Claude Code.

### "Engine HTTP 403"
Your license may have been revoked or expired. Contact dancycodes@gmail.com.

### "Engine HTTP 401"
Missing or malformed license key. Double-check the key value.

### Both MCP servers failed to start
Run `npx @dancycodes/dd-manager-proxy` manually to see the error.

## Privacy

- Your project specs, features, bugs, and code stay on your machine.
- We collect telemetry on tool usage (license_key + tool_name + timestamp) to detect abuse and to bill usage-based plans later. No code, no project content.

## License

Proprietary. See LICENSE.md.

---
(c) DancyCodes. All rights reserved.
