# Changelog

All notable changes to DancyCodes Pro (plugin + proxy + engine).

The format follows [Keep a Changelog](https://keepachangelog.com/), and this project follows [Semantic Versioning](https://semver.org/).

---

## v0.1.1 — 2026-04-25

### Fixed

- **License validation gate** (proxy + engine): the proxy now validates the license key against the engine on startup BEFORE connecting stdio. Three explicit failure modes — no key set / placeholder unsubstituted, malformed key, engine-rejected key — each prints a clear stderr message with actionable next steps. Previously, the proxy would silently start with local CRUD tools registered regardless of key validity, making `/mcp` show `connected` even when the key was bogus. Now `/mcp` shows `failed` and the exact reason is in the MCP debug pane.
- **Plugin SKILL.md**: added a "BEFORE FIRST USE" callout that surfaces the `/plugin config dancycodes-pro-marketplace/dancycodes-pro` workflow when Claude Code's `/plugin install` did NOT auto-prompt for the license key. Confirmed via fresh-machine test that the auto-prompt is unreliable across Claude Code versions.

### Added

- **Engine endpoint**: `GET /licenses/check` (public, takes `X-License-Key` header) — lets the proxy verify a key on startup and lets users diagnose key issues via the standalone `dancycodes-check-license` CLI.
- **Engine admin endpoints**:
  - `GET /admin/list-licenses` with filters: `status` (active/revoked/expired/all), `plan`, `email` (substring), `limit`/`offset`. Returns truncated key prefixes (first 16 chars + `...`) to avoid leaking full keys.
  - `GET /admin/license/:prefix` — single-license detail + last 20 telemetry rows.
  - `POST /admin/revoke-license` now accepts `{prefix, reason}` (preferred — single-match validation + safer UX) in addition to the existing `{key, reason}`.
- **Engine versioning**: every response now carries `X-DancyCodes-Engine-Version` header. `GET /` now returns `version` + `min_proxy_version` so proxies can detect compatibility issues.
- **Proxy startup version check**: warns (non-fatal) if the local proxy is older than the engine's declared `min_proxy_version`.
- **Proxy CLI tool**: `npx -y @dancycodesorg/dd-manager-proxy` exposes a second binary `dancycodes-check-license` for standalone license diagnostics without spinning up the full MCP server.
- **PowerShell admin helpers** (gitignored — local-only): `admin/list-licenses.ps1`, `admin/license-detail.ps1`. `admin/revoke-license.ps1` now uses prefix-based revocation with confirmation prompt.
- **Database**: `gumroad_sale_id` column on `licenses` table (preparing for Gumroad migration).

### Changed

- **Proxy version**: `0.1.0` → `0.2.0` (behavior change: now exits 1 on bad license key instead of silently connecting). Published to npm as `@dancycodesorg/dd-manager-proxy@0.2.0`.
- **Engine version**: `0.1.0` → `0.1.1`. Stamped via `X-DancyCodes-Engine-Version` header on every response.

### Removed

- **LemonSqueezy webhook handler**: deleted. Payment processor migrating to Gumroad in v0.1.2 (better fit for the developer's Cameroon-based payment flow). LemonSqueezy columns (`lemonsqueezy_order_id`, `lemonsqueezy_license_id`) kept nullable on the `licenses` table for backwards compatibility — no rows ever populated them.

---

## v0.1.0 — 2026-04-24 (Free Beta)

First public release.

### Added

- 5-phase methodology engine (interview_intro, state_setup, generation_pipeline, validation, review)
- 19 full references available via `dc_get_reference`
- 4 UI skill generation tiers (Stitch MCP / ui-designer / Claude research / user-provided)
- 41+ MCP tools in the proxy (30 local CRUD + 8 remote-forwarded + 4 methodology)
- Mandatory web_search research pass during Phase 1 interview
- Gap analysis before Phase 2 transition
- Generator-Evaluator loop with sprint contracts
- Module boundary QA sweeps
- Finalizer (complexity-adapted: 8/15/15+module checks)
- LemonSqueezy webhook integration for auto-issuing licenses
- License validation with D1-backed 24h cache + revocation support

### Infrastructure

- Cloudflare Workers + D1 hosting ($0/month free tier)
- `@dancycodesorg/dd-manager-proxy` published to npm
- Claude Code plugin published as GitHub marketplace

### Known Limits

- Stack-native extractions are not yet pre-computed (Task #12) — currently generated live from skill source
- Abuse detection + auto-revocation deferred to v1.1 (Task #14)
