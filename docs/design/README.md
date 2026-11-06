# Design Documentation

This directory describes the current implementation: domain invariants, constraints, threat models, and mechanics. Source code stays comment-free by policy (see [`.claude/rules/comments.md`](../../.claude/rules/comments.md)); historical records are in the [archive](../archive/README.md).

Division of labor with [`.claude/rules/`](../../.claude/rules/): rule files hold **imperatives** agents and reviewers must follow (short, path-scoped, auto-loaded); design docs hold the **reasoning and mechanics** behind them. When a doc states a constraint that is mechanically enforceable, the enforcement lives in [`scripts/check-rules.ts`](../../scripts/check-rules.ts) and the imperative in a rule file — the doc links both.

| Doc | Domain |
|---|---|
| [`data-model.md`](data-model.md) | Schema, invariants, calculations and projection |
| [`api.md`](api.md) | tRPC and MCP contracts: procedures, inputs, outputs and errors |
| [`data-integrity.md`](data-integrity.md) | Cloudflare D1 limits (100 bound parameters, chunking), `db.batch()` atomicity and statement ordering, keyset pagination, N+1 avoidance, TOCTOU guards, unique-constraint error shapes, UTC date handling |
| [`data-audits.md`](data-audits.md) | Current database audit checks, activation and deployment gates |
| [`sessions-and-live-editing.md`](sessions-and-live-editing.md) | Entry and play-session lifecycle, projection, rule versions and live editing |
| [`game-masters.md`](game-masters.md) | Game group / variant / mix masters, normalized composition and seeding |
| [`game-lineups.md`](game-lineups.md) | Immutable lineups and rule versions, stakes, prices and master ↔ entry rule operations |
| [`statistics.md`](statistics.md) | Settled-entry population, native / valuation / normalized modes and coverage, bb and bi units, time, EV, breakdown and series keys |
| [`mcp-and-oauth.md`](mcp-and-oauth.md) | MCP OAuth consent gate threat model, discovery endpoints, token expiry, tool projection, Workers runtime constraints |
| [`passkeys.md`](passkeys.md) | WebAuthn relying-party pinning across the split origin, the `passkey` table contract, silent conditional-create upgrades, device naming, plugin version coupling |
| [`ai-extraction.md`](ai-extraction.md) | AI extraction timeout and retry, structured-output contracts, truncation failure model and model pinning |
| [`web-platform.md`](web-platform.md) | Persisted-cache busting, open-redirect guard, shared UI component traps, filter presets, geolocation and maps, number formatting |
| [`cryst-exceptions.md`](cryst-exceptions.md) | Exceptions policy for future Cryst screens: record local departures with reasons, promote repeated needs to the design system, and remove obsolete exceptions |
| [`testing-and-tooling.md`](testing-and-tooling.md) | Test mechanisms, D1 integration, HTTP/browser boundaries, Vitest, CI, migrations, seed/restore and `check-rules.ts`. Rules live in [testing.md](../../.claude/rules/testing.md); commands in the [run guide](../testing-environment.ja.md) |
| [`pr-review.md`](pr-review.md) | Automated PR review loop, gating, state and severity rubric |
| [`agent-workflow.md`](agent-workflow.md) | Settings outside the repo that the agent loop relies on: Linear statuses and GitHub integration, GitHub rulesets / merge settings / secrets, Orca base ref and setup, per-agent hooks, the release Released step |
