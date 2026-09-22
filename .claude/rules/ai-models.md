---
paths:
  - "packages/api/**"
  - "apps/web/**"
  - "apps/server/**"
---

# OpenAI Model Selection

Why this file exists: scattered inline model IDs let features drift across model generations. When `extractTablePlayers` was upgraded, `extractTournamentData` was left a generation behind (PR #572). The policy is: **all AI features always use the same latest model**.

## Write model IDs only in `packages/api/src/ai/models.ts`

- When a new model is released, update [`LATEST_MODEL`](../../packages/api/src/ai/models.ts). Every feature follows that change automatically.
- Callers use `AI_MODELS.<featureName>`. Add one key to `AI_MODELS` for each new AI feature. `satisfies Record<string, typeof LATEST_MODEL>` makes assigning an older model ID a **type error**.
- `scripts/check-rules.ts` prohibits `gpt-*` literals outside `models.ts`. The OpenAI SDK's model type is a permissive union containing `string & {}`, so type checking alone cannot detect typos or hardcoded older models.

## Do not resolve the "latest" model automatically at runtime

Do not query the Models API and select the newest model by date. Model upgrades require human review because they can introduce breaking API changes, and because automatic selection by date can silently switch to a model with different pricing or a different tier (preview models, or the far more expensive frontier tier).

`gpt-5.6` is an **alias** OpenAI repoints as the family moves; `AI_MODELS` pins the concrete tier (`gpt-5.6-luna`) so a provider-side alias change cannot alter behavior or cost without a PR. The family's tiers — `sol` (flagship), `terra`, `luna` (cheapest) — differ in price and latency, not in API shape: all three take image input and strict Structured Outputs, so moving between them is a one-line edit. Luna is the current pick: it was tried against the real screenshots and extracted them acceptably at roughly a twentieth of the flagship's price. Do not move up a tier without evidence from those screenshots that Luna is the cause of a failure — an extraction error is far more often a prompt or schema problem than a tier problem.

## Every AI call goes through the Responses API with Structured Outputs

[`ai-extract.ts`](../../packages/api/src/routers/ai-extract.ts) calls `client.responses.parse()` with `text.format: zodTextFormat(<schema>, "<name>")`. Do not add `chat.completions` calls: two API surfaces means two truncation conventions and two parse paths.

**Strict Structured Outputs cannot omit a field.** Every property is forced into `required` with `additionalProperties: false`, so a Zod `.optional()` in a wire schema becomes a field the model *must* emit. Optional data is therefore modelled as `.nullable()` in the OpenAI-facing schemas (`TOURNAMENT_OUTPUT_SCHEMA`, `TABLE_PLAYERS_OUTPUT_SCHEMA`), and the nulls are stripped before the result is validated against the app-facing contract (`ExtractedTournamentDataSchema`). Keep those two schemas separate: the app contract is what the web client's merge helpers consume, and it must keep using `.optional()` so an unknown field stays absent rather than arriving as `null`.

Strict mode also rejects `allOf` / `oneOf` / `not` / `uniqueItems` / `propertyNames` and caps nesting at five levels. Numeric and string bounds (`minimum`, `maximum`, `minLength`) are accepted but **not enforced by the model** — they are guidance only, which is why the router re-validates every response with Zod.

## Include reasoning in the `max_output_tokens` budget

`max_output_tokens` limits the **combined total** of reasoning and response text. Setting the limit barely above the expected output size lets reasoning consume the budget, truncating structured output and leaving `output_parsed` null (causing an `AI did not return structured data` failure). Extraction features use [`EXTRACTION_MAX_OUTPUT_TOKENS`](../../packages/api/src/ai/models.ts). Only generated tokens are billed, so allocating extra headroom does not itself increase cost.

Truncation is reported by `response.incomplete_details.reason === "max_output_tokens"`, not by a stop reason on the content. A response can be `status: "incomplete"` for other reasons (`content_filter`, `steered`) while still carrying a schema-valid `output_parsed`, so check the status before trusting the payload — a partial extraction that validates is the failure mode that silently writes wrong data.

## Model upgrade checklist

1. Check the target model's breaking changes against <https://developers.openai.com/api/docs/guides/latest-model>.
2. Review existing calls for changes in how `reasoning`, verbosity, and sampling parameters are handled. Reasoning models reject `temperature` / `top_p`.
3. Verify that `max_output_tokens` leaves room for reasoning.
4. Check prompt behavior changes against the actual model. Do not lock prompt wording in tests: it is an implementation detail, and doing so only adds test maintenance on every adjustment.
