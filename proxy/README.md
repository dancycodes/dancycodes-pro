# @dancycodesorg/dd-manager-proxy

Local MCP proxy for [DancyCodes Pro](https://dancycodes.com) — spec-driven software delivery for Claude Code.

**⚠️ This package is NOT meant to be installed manually.** It's consumed automatically by the [dancycodes-pro Claude Code plugin](https://github.com/dancycodes/dancycodes-pro). If you're here by mistake, install the plugin instead.

## What It Does

This MCP server runs locally on your machine when invoked by the DancyCodes Pro plugin. It:

- Hosts the project's SQLite database at `{project}/.executor/dancydev.db`
- Exposes ~42 MCP tools for spec-driven development:
  - **30 local CRUD tools**: project, features, QA, bugs, fixes, conventions, errors, sprint contracts, evaluations, module QA, config
  - **8 remote-forwarded tools**: proprietary algorithms (topological sort, Levenshtein dedup, eligibility composition, recovery) forwarded to the DancyCodes engine
  - **4 methodology tools**: `dc_load_phase`, `dc_transition_phase`, `dc_get_reference`, `dc_list_references` forwarded to the engine

- Keeps all user project data local — only algorithm state is sent to the engine per-call, never stored remotely.

## Installation (via the plugin, not manually)

In Claude Code:

```
/plugin marketplace add https://github.com/dancycodes/dancycodes-pro
/plugin install dancycodes-pro
```

When prompted, enter your DancyCodes Pro license key. Get a free beta key by emailing dancycodes@gmail.com.

## Requirements

- Node.js 20+
- A DancyCodes Pro license key (free beta available)
- Claude Code (the plugin host)

## License

Proprietary — DancyCodes Pro License. See LICENSE file.

## Links

- Documentation: https://dancycodes.com/docs
- Issues: https://github.com/dancycodes/dancycodes-pro/issues
- Support: dancycodes@gmail.com
