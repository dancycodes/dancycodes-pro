# DancyCodes Pro

**Spec-driven software delivery for Claude Code.** Interview → spec → implement → QA → complete, all orchestrated via a single Claude Code plugin.

> **Status**: v0.1 free beta. Get a license by emailing dancycodes@gmail.com.

## Quick Start

In Claude Code:

```
/plugin marketplace add https://github.com/dancycodes/dancycodes-pro
/plugin install dancycodes-pro
```

When prompted, enter your DancyCodes Pro license key. Then invoke the skill:

```
Spec out my app using dancycodes
```

Claude will interview you across 12 structured sub-phases, run industry research, derive 60-400 features with proper MoSCoW prioritization, and generate a complete `{project}-specs` skill + stack-native executor/evaluator/QA agents.

## Architecture

Three components, one plugin:

| Component | Where it runs | Source |
|-----------|---------------|--------|
| [Plugin](plugin/) | Your Claude Code session | This repo |
| [Proxy MCP](proxy/) (`@dancycodesorg/dd-manager-proxy`) | Your machine (locally, via npx) | [npm](https://www.npmjs.com/package/@dancycodesorg/dd-manager-proxy) |
| Engine | Cloudflare Worker (`dancycodes-engine.dancycodes.workers.dev`) | Not open source |

- **Plugin**: thin SKILL.md + 4 agents + .mcp.json.
- **Proxy**: local SQLite + 30 CRUD tools + forwards 12 proprietary algorithm/methodology calls to the engine.
- **Engine**: methodology (5 phases + 19 references), license validation, usage telemetry.

**Your project data stays on your machine.** The engine never stores user project content — only per-call algorithm state and usage telemetry (license key + tool name + timestamp).

## Required Dependencies

Before installing, make sure you have:

- [skill-creator](https://github.com/anthropics/skills) (Anthropic) — used during skill generation
- [find-skills](https://github.com/anthropics/skills) (Anthropic) — used during skill curation
- [Playwright MCP](https://github.com/microsoft/playwright-mcp) (Microsoft) — required for features testing via browser

**Recommended (optional):**

- [Stitch MCP](https://stitch.tools) (Google) — enables Tier 1 UI skill generation (design tokens from Figma/Stitch screens)

## What You Get

- **12-phase structured interview** with mandatory `web_search` research at every round
- **Industry-standard gap analysis** before scope is confirmed (catches features competitors ship that you forgot)
- **60-400 feature specs** with tiered section ceilings, INVEST validation, 7 splitting strategies
- **Per-project UI design skill** (4 tiers: Stitch MCP, ui-designer, Claude research, or bring-your-own)
- **Stack-native agents** (300-600-line executor, 200-400-line evaluator & QA) with skills compiled-in
- **Generator-Evaluator loop** with sprint contracts, module boundary QA, compaction recovery
- **Finalizer** with 8/15/15+module audit adapted to project complexity
- **Permanent test suite generation** after all features done

## Pricing

Currently in **v0.1 free beta**. Test phase — no payments collected.

Post-beta plans (not yet active):
- **Community** — Free — 1 active project
- **Pro** — $29 one-time or $12/month — unlimited projects
- **Team** — $49/seat — team license
- **Agency** — $199 — unlimited seats, priority support

Purchases will be processed via [LemonSqueezy](https://lemonsqueezy.com) (merchant of record handles tax).

## Repo Layout

```
dancycodes-pro/
├── .claude-plugin/marketplace.json    Claude Code plugin marketplace manifest
├── plugin/                            The Claude Code plugin (SKILL + agents + .mcp.json)
├── proxy/                             The @dancycodesorg/dd-manager-proxy npm package
├── engine/                            Cloudflare Worker source (not open source)
├── landing/                           Marketing site (optional)
└── docs/                              Build notes
```

## Support

- Issues: https://github.com/dancycodes/dancycodes-pro/issues
- Email: dancycodes@gmail.com
- Docs: https://dancycodes.com/docs

## License

Proprietary — DancyCodes Pro License. See [LICENSE](LICENSE) file.
