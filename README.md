# DancyCodes Pro

**Spec-driven software delivery for Claude Code.** Interview → spec → implement → QA → complete, orchestrated through a single plugin.

> **v0.1 free beta.** Get a license by emailing dancycodes@gmail.com. Reply within 24 hours.

## 📘 Full User Guide

**→ [Complete setup + usage guide](docs/USER-GUIDE.md) ←**

Everything you need to install and use DancyCodes Pro on a fresh computer: requirements, one-time setup, per-project setup, trigger phrases, resuming projects, troubleshooting, pricing, and full command reference.

## Quick Install

```
/plugin marketplace add https://github.com/dancycodes/dancycodes-pro
/plugin install dancycodes-pro
```

Enter your license key when prompted. Then:

```
Spec out my app using dancycodes
```

Claude interviews you across 12 structured sub-phases, runs industry research, and generates a complete `{project}-specs` skill + stack-native executor/evaluator/QA agents.

## Architecture

| Component | Where it runs | Source |
|-----------|---------------|--------|
| [Plugin](plugin/) | Your Claude Code session | This repo |
| [Proxy MCP](proxy/) `@dancycodesorg/dd-manager-proxy` | Your machine (via `npx`) | [npm](https://www.npmjs.com/package/@dancycodesorg/dd-manager-proxy) |
| Engine | Cloudflare Worker | Proprietary (not in repo) |

**Your project data stays on your machine.** The engine receives only per-call algorithm state + usage telemetry.

## Required Dependencies

See the [User Guide — Requirements section](docs/USER-GUIDE.md#requirements) for the full list. TL;DR:

- Node.js 20+
- Git
- Claude Code with `skill-creator`, `find-skills`, and `playwright` MCP configured

## What You Get

- 12-phase structured interview with **mandatory `web_search` research** at every project
- **Industry-standard gap analysis** before scope is confirmed
- **60-400 feature specs** with tiered section ceilings, INVEST validation, 7 splitting strategies
- **4-tier UI skill generation** (Stitch MCP / ui-designer / Claude research / bring-your-own)
- **Stack-native agents** (300-600-line executor, 200-400-line evaluator + QA) with compiled-in skills
- **Generator-Evaluator loop** with sprint contracts, module boundary QA, compaction-resilient recovery
- **Finalizer** with complexity-adapted audit (8 / 15 / 15+module checks)
- **Permanent test suite generation** after implementation completes

## Pricing

Currently v0.1 free beta. Post-beta tiers:

| Tier | Price | Scope |
|---|---|---|
| Community | Free | 1 active project |
| Pro | $29 one-time or $12/mo | Unlimited projects |
| Team | $49/seat | Team license |
| Agency | $199 | Unlimited seats, priority support |

Details in the [User Guide — Pricing section](docs/USER-GUIDE.md#pricing--licenses).

## Repo Layout

```
dancycodes-pro/
├── .claude-plugin/marketplace.json    Plugin marketplace manifest
├── plugin/                            The Claude Code plugin
├── proxy/                             @dancycodesorg/dd-manager-proxy npm package source
├── docs/                              Documentation (USER-GUIDE.md etc.)
├── landing/                           Marketing site (optional)
└── engine/                            Cloudflare Worker source (NOT in this repo — proprietary)
```

## Support

- [User Guide](docs/USER-GUIDE.md)
- [GitHub Issues](https://github.com/dancycodes/dancycodes-pro/issues)
- dancycodes@gmail.com

## License

Proprietary — [DancyCodes Pro License](LICENSE).
