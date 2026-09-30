# AI Extraction

This document covers the AI extraction subsystem: the two `aiExtractRouter` procedures in [`packages/api/src/routers/ai-extract.ts`](../../packages/api/src/routers/ai-extract.ts) — `extractTournamentData` (tournament details from screenshots) and `extractTablePlayers` (seated players from a poker-app screenshot) — the model and token configuration in [`packages/api/src/ai/models.ts`](../../packages/api/src/ai/models.ts), and how the web tournament form merges extraction results over user input (SA2-77).

## Model registry (`AI_MODELS`)

The imperatives around model IDs — single home in `models.ts`, no runtime "latest" resolution, `max_output_tokens` must include the reasoning budget, upgrade checklist — live in [`.claude/rules/ai-models.md`](../../.claude/rules/ai-models.md). This section records only the registry contents and how the rule is enforced.

Enforcement is deliberately split across three mechanisms, which is why [`models.test.ts`](../../packages/api/src/ai/__tests__/models.test.ts) asserts only `EXTRACTION_MAX_OUTPUT_TOKENS`:

- That every `AI_MODELS` entry is `LATEST_MODEL` is guaranteed **at the type level** by `satisfies Record<string, typeof LATEST_MODEL>` in `models.ts`.
- That call sites never hard-code `gpt-*` literals is guaranteed by [`scripts/check-rules.ts`](../../scripts/check-rules.ts) — the OpenAI SDK's model type is a loose union including `string & {}`, so the type checker alone catches neither typos nor stale model IDs.
- The one plain runtime value left, `EXTRACTION_MAX_OUTPUT_TOKENS` (currently 8192), is covered by the test.

`EXTRACTION_MAX_OUTPUT_TOKENS` is the output cap for both extraction requests. It is sized well above the realistic output size because `max_output_tokens` bounds reasoning **plus** response text, and only generated tokens are billed — headroom is free, while a tight cap turns into the truncation failure below.

`LATEST_MODEL` pins a concrete tier (`gpt-5.6-luna`) rather than the `gpt-5.6` alias, so OpenAI repointing the alias cannot change behavior or cost without a PR. Luna is the family's cheapest tier, chosen because it was tried against the real screenshots and read them acceptably at roughly a twentieth of the flagship's price. All three tiers take image input and strict Structured Outputs, so moving between them is a one-line edit here.

## Two schemas per procedure: strict wire, optional contract

Both procedures call `client.responses.parse()` with `text.format: zodTextFormat(...)`. Strict Structured Outputs forces **every** property into `required` with `additionalProperties: false`, so "the model may omit what it did not find" cannot be expressed by omission — it has to be expressed by `null`.

Each procedure therefore has two schemas:

| Schema | Role | Optionality |
|---|---|---|
| `TOURNAMENT_OUTPUT_SCHEMA` / `TABLE_PLAYERS_OUTPUT_SCHEMA` | Sent to OpenAI as the strict JSON Schema | `.nullable()` — every key present, unknown values are `null` |
| `ExtractedTournamentDataSchema` | The app-facing contract the web client consumes | `.optional()` — unknown keys are absent |

`withoutNulls` bridges them: it strips every `null` from `output_parsed` before `ExtractedTournamentDataSchema.safeParse`, so an unknown field arrives at [`merge-extracted-tournament-data.ts`](../../apps/web/src/features/rooms/utils/merge-extracted-tournament-data.ts) as `undefined`, exactly as it did under the previous provider. Collapsing the two into one schema is what would break: a `.nullable()` app contract would make every blank field a `null` the merge helpers must re-handle, and an `.optional()` wire schema is rejected by strict mode.

The `.describe()` strings on the wire schema are runtime prompt data sent to the model — they are what tells it to answer `null` rather than invent a value. Numeric bounds (`minimum` / `maximum`) ride along as guidance only; strict mode does not enforce them, which is why the response is re-validated with Zod.

Consequence: an all-optional contract cannot distinguish "nothing found" from "output cut off". That is exactly what the status gate exists for.

## Truncation failure model

**Both procedures run `assertNotTruncated(response)` BEFORE any schema validation** — before `safeParse` in `extractTournamentData`, before reading `output_parsed` in `extractTablePlayers`. A truncated response is rejected even when it passes the schema, because it is incomplete.

Why this ordering is load-bearing:

- **Truncation is a realistic failure path.** Reasoning shares `max_output_tokens` with the response text, so exhausting the budget cuts structured output mid-stream.
- **The guard buys attribution, not rescue.** The SDK parses only a `status: "completed"` response (`shouldParse` in `openai/lib/ResponsesParser`), so `output_parsed` is already null whenever the turn was cut short. Dropping the guard would not leak a half-filled object; it would report every incomplete response as `AI did not return structured data`, which sends the reader at the prompt when the real remedy is the token budget (`max_output_tokens`) or a provider-side stop (`content_filter`, `steered`).
- **The contract cannot tell the two apart on its own.** Every field of `ExtractedTournamentDataSchema` is `.optional()`, so `{}` is a valid extraction result — "found nothing" and "was cut off" are the same value once the status is discarded. `blindLevels` is the field that can actually eat the budget, and a silently-truncated blind structure is the outcome the ordering prevents.

Because the wire schema is enforced inside the SDK (`zodTextFormat` installs `schema.parse` as `$parseRaw`), an off-schema response throws a `ZodError` out of `responses.parse()` rather than returning a bad value. `parseStructuredResponse` converts that — and a malformed-JSON `SyntaxError` — into the same `Failed to parse AI response`, so raw Zod text never reaches the client. The router's own `safeParse` against the app contract then stays as **drift protection**: it is what fires if the wire schema and `ExtractedTournamentDataSchema` are ever edited out of step.

Regression coverage: [`packages/api/src/__tests__/ai-extract-truncation.test.ts`](../../packages/api/src/__tests__/ai-extract-truncation.test.ts).

### Truncation vs. incomplete vs. missing structured output

These have different causes and different remedies, so they are reported as **separate errors**:

| Failure | Error | Remedy direction |
|---|---|---|
| `incomplete_details.reason === "max_output_tokens"` | `AI response was truncated (max_output_tokens reached)` | Budget: raise `EXTRACTION_MAX_OUTPUT_TOKENS` / shrink input. |
| `status === "incomplete"` for any other reason (`content_filter`, `steered`) | `AI response was incomplete` | The response was cut off by a provider-side policy, not by the budget. |
| Null `output_parsed` with a completed status | `AI did not return structured data` (`missingStructuredOutputError`) | Model/prompt behavior, not budget. |

Collapsing them into one error would hide which knob to turn.

## Merging extracted data into the tournament form (SA2-77)

[`apps/web/src/features/rooms/utils/merge-extracted-tournament-data.ts`](../../apps/web/src/features/rooms/utils/merge-extracted-tournament-data.ts) merges AI-extracted tournament data over the values the user has already entered (`base`). Blank extracted values never overwrite an existing value — only meaningful values are applied.

- **AI-blank fields are ignored** so they never overwrite information the user has already entered (SA2-77). A string counts as blank when it is empty after trim (`hasText`).
- **An explicit 0 is not blank — for fields where 0 is real.** Only non-negative finite numbers are valid; an explicit 0 (e.g. a freeroll's `buyIn` / `entryFee`) is distinguished from blank and applied (SA2-77). But `startingStack` / `tableSize` real values are always positive, so for those fields 0 is ignored as AI filler.
- **Non-AI fields carried on `base`** (`bountyAmount` / `currencyId` / `memo` / `tags`) are preserved as-is.

### The merge base is the current form values, not `initialFormValues`

So that a blank AI result never overwrites what the user has typed *during* the session, the merge base is the form's **live** values at extraction time, read through a getter ref ([`use-tournament-form-sheet.ts`](../../apps/web/src/features/rooms/components/tournament-form-sheet/use-tournament-form-sheet.ts)'s `registerLiveValues`), not `initialFormValues` (SA2-77). Merging over `initialFormValues` instead would silently wipe anything entered after the sheet opened whenever the AI returned blanks.
