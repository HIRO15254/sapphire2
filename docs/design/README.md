# Design Documentation

This directory is the durable home for **why the code is shaped the way it is**: domain invariants, constraints, threat models, and the traps that past incidents taught us. Source code stays comment-free by policy (see [`.claude/rules/comments.md`](../../.claude/rules/comments.md)) — the knowledge that used to live in comments lives here instead, indexed and reviewed.

Division of labor with [`.claude/rules/`](../../.claude/rules/): rule files hold **imperatives** agents and reviewers must follow (short, path-scoped, auto-loaded); design docs hold the **reasoning and mechanics** behind them. When a doc states a constraint that is mechanically enforceable, the enforcement lives in [`scripts/check-rules.ts`](../../scripts/check-rules.ts) and the imperative in a rule file — the doc links both.

Issue references (`SA2-NNN`) point at the Linear issues that motivated a decision; `(cNN)` marks findings from review threads.

| Doc | Domain |
|---|---|
| [`data-integrity.md`](data-integrity.md) | Cloudflare D1 limits (100 bound parameters, chunking), `db.batch()` atomicity and statement ordering, keyset pagination, N+1 avoidance, TOCTOU guards, unique-constraint error shapes, UTC date handling |
| [`sessions-and-live-editing.md`](sessions-and-live-editing.md) | Event-sourced session lifecycle, payload invariants, ownership contracts, frozen rule snapshots, live-linked editing, optimistic updates, session wizard |
| [`game-masters.md`](game-masters.md) | Game group / variant / mix master data: self-freezing labels, the migration-0049 compat mirror, seeding idempotency, derived mix buckets |
| [`statistics.md`](statistics.md) | EV recording gate and population semantics, summary agreement, breakdown bucketing, URL-based stats filters, period boundaries |
| [`mcp-and-oauth.md`](mcp-and-oauth.md) | MCP OAuth consent gate threat model, discovery endpoints, token expiry, tool projection, Workers runtime constraints |
| [`passkeys.md`](passkeys.md) | WebAuthn relying-party pinning across the split origin, the `passkey` table contract, silent conditional-create upgrades, device naming, plugin version coupling |
| [`ai-extraction.md`](ai-extraction.md) | AI extraction truncation failure model, schema design, model pinning, form-merge semantics |
| [`web-platform.md`](web-platform.md) | Persisted-cache busting, open-redirect guard, shared UI component traps, filter presets, geolocation and maps, number formatting |
| [`testing-and-tooling.md`](testing-and-tooling.md) | Mock-db contract, test-infra gotchas, migration tests on `bun:sqlite`, preview seed/restore pipeline, `check-rules.ts` mechanics |
