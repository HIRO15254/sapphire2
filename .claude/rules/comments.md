---
paths:
  - "apps/**"
  - "packages/**"
  - "scripts/**"
---

# Code Comments (near-zero policy)

Why this file exists: the repo-wide cleanup (PR #591) removed ~5,000 comment lines whose knowledge now lives, reviewed and indexed, in [`docs/design/`](../../docs/design/README.md) and `.claude/rules/` — knowledge duplicated into comments drifts from both the code and its documented home.

## The only comments allowed in `.ts` / `.tsx` / `.css`

1. **Machine directives** — `biome-ignore …` (the reason string is part of the directive), `@ts-expect-error`, `@ts-nocheck`, `/// <reference …>`, and inline annotations such as `/* @__PURE__ */`. Never delete one; never add one without its reason.
2. **`// NOTE(rule): <rule-file> — <why>`** — a justification another rule file explicitly mandates. Currently only [`api-data-integrity.md`](api-data-integrity.md)'s Zod-deviation comment.
3. **`// NOTE(ops): <instruction>`** — an operational instruction that must be **executed at that code site** when editing it (e.g. the cache-buster bump in [`apps/web/src/main.tsx`](../../apps/web/src/main.tsx), SA2-154). An explanation is not an instruction — explanations go to `docs/design/`.

Marker format: a contiguous run of `//` lines whose **first** line starts with the marker. Block comments (`/* */`), JSDoc (`/** */`), and JSX comments (`{/* */}`) are never whitelisted.

## Everything else is deleted, not written

- Design rationale, invariants, trap warnings ("changing X breaks Y") → the owning [`docs/design/`](../../docs/design/README.md) doc, in English.
- Enforceable imperatives → a `.claude/rules/` file, plus a [`scripts/check-rules.ts`](../../scripts/check-rules.ts) check when greppable.
- No JSDoc (one-liners included), no section dividers, no narration of the next line — in tests too.
- Trailing comments (`code(); // …`) are equally banned; they are prose-only because a mechanical scan trips over `//` inside string literals.

Generated files (`routeTree.gen.ts`) and `packages/db/src/migrations/**` are out of scope — `--> statement-breakpoint` in migration SQL is functional.

The comments that do exist are written in English.

## Verification

Enforced by `scripts/check-rules.ts` (Stop hook + CI): a banned-divider pattern and a per-file count of non-whitelisted line-leading comments with a threshold of **zero**.
