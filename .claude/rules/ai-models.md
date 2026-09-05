---
paths:
  - "packages/api/**"
  - "apps/web/**"
  - "apps/server/**"
---

# Claude Model Selection

Why this file exists: scattered inline model IDs let features drift across model generations. When `extractTablePlayers` was upgraded to Opus 5, `extractTournamentData` was left on Opus 4.8 (PR #572). The policy is: **all AI features always use the same latest model**.

## Write model IDs only in `packages/api/src/ai/models.ts`

- When a new model is released, update [`LATEST_MODEL`](../../packages/api/src/ai/models.ts). Every feature follows that change automatically.
- Callers use `AI_MODELS.<featureName>`. Add one key to `AI_MODELS` for each new AI feature. `satisfies Record<string, typeof LATEST_MODEL>` makes assigning an older model ID a **type error**.
- `scripts/check-rules.ts` prohibits `claude-*` literals outside `models.ts`. The Anthropic SDK's `Model` type is a permissive union containing `string & {}`, so type checking alone cannot detect typos or hardcoded older models.

## Do not resolve the "latest" model automatically at runtime

Do not query the Models API and select the newest model by date. Model upgrades require human review because they can introduce breaking API changes:

- Opus 5 enables thinking by default, even when `thinking` is omitted.
- Opus 4.7 removed `temperature` / `top_p` / `top_k` / `budget_tokens`; sending them returns a 400 response.
- Opus 4.7 changed the tokenizer, increasing the token count for the same input to approximately 1.3 times that of earlier models. Opus 4.8 / Opus 5 / Sonnet 5 / Fable 5 use this new tokenizer. Upgrades within the same tokenizer generation do not change token count estimates.

Automatic selection by date can also silently switch to a model with different pricing or a different tier, such as preview models, Haiku models, or the $10/$50 Fable models.

## Include thinking in the `max_tokens` budget

`max_tokens` limits the **combined total** of thinking and response text, and thinking is enabled by default from Opus 5 onward. Setting the limit barely above the expected output size lets thinking consume the budget, truncating structured output and leaving `parsed_output` null (causing an `AI did not return structured data` failure). Extraction features use [`EXTRACTION_MAX_TOKENS`](../../packages/api/src/ai/models.ts). Only generated tokens are billed, so allocating extra headroom does not itself increase cost.

## Model upgrade checklist

1. Check the target model's breaking changes. In Claude Code, use `/claude-api migrate`; otherwise, read the official migration guide at <https://platform.claude.com/docs/en/about-claude/models/migration-guide>.
2. Review existing calls for changes in how `thinking`, `effort`, and sampling parameters are handled.
3. Verify that `max_tokens` leaves room for thinking.
4. Check prompt behavior changes, such as verbosity and tool-call frequency, against the actual model. Do not lock prompt wording in tests: it is an implementation detail, and doing so only adds test maintenance on every adjustment.
