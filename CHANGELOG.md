# Changelog

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
- LemonSqueezy payouts via Payoneer pending user's Payoneer approval (blocked in Cameroon for 1-3 business days after signup)
