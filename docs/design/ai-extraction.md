# AI Extraction

This document covers the AI extraction subsystem: the two `aiExtractRouter` procedures in [`packages/api/src/routers/ai-extract.ts`](../../packages/api/src/routers/ai-extract.ts) — `extractTournamentData` (tournament details from screenshots) and `extractTablePlayers` (seated players from a poker-app screenshot) — the model and token configuration in [`packages/api/src/ai/models.ts`](../../packages/api/src/ai/models.ts), and how the web tournament form merges extraction results over user input (SA2-77).

## Model registry (`AI_MODELS`)

The imperatives around model IDs — single home in `models.ts`, no runtime "latest" resolution, `max_tokens` must include the thinking budget, upgrade checklist — live in [`.claude/rules/ai-models.md`](../../.claude/rules/ai-models.md). This section records only the registry contents and how the rule is enforced.

Key → feature map:

| `AI_MODELS` key | Feature |
|---|---|
| `seating` | Reading seated players from a screenshot (`extractTablePlayers`). |
| `tournamentExtraction` | Extraction of tournament information (`extractTournamentData`). |

Enforcement is deliberately split across three mechanisms, which is why [`models.test.ts`](../../packages/api/src/ai/__tests__/models.test.ts) asserts only `EXTRACTION_MAX_TOKENS`:

- That every `AI_MODELS` entry is `LATEST_MODEL` is guaranteed **at the type level** by `satisfies Record<string, typeof LATEST_MODEL>` in `models.ts`.
- That call sites never hard-code `claude-*` literals is guaranteed by [`scripts/check-rules.ts`](../../scripts/check-rules.ts) — the Anthropic SDK's `Model` type is a loose union including `string & {}`, so the type checker alone catches neither typos nor stale model IDs.
- The one plain runtime value left, `EXTRACTION_MAX_TOKENS` (currently 8192), is covered by the test.

`EXTRACTION_MAX_TOKENS` is the output cap for both extraction requests. It is sized well above the realistic output size because `max_tokens` bounds thinking **plus** response text, and only generated tokens are billed — headroom is free, while a tight cap turns into the truncation failure below.

## Output schema: every field optional

Both extraction tools make every output field optional by design:

- The tournament tool's JSON Schema (`TOOL_INPUT_SCHEMA`) declares `required: []` — all fields omittable, so the model includes only what is explicitly stated in the source. The per-field description strings in the tool definition (runtime prompt data sent to the model) reinforce this: omit unknown fields; empty strings and `null` are forbidden. The point is that the model omits unknowns instead of hallucinating or padding with empty values.
- The Zod read side mirrors it: every field of `ExtractedTournamentDataSchema` is `.optional()`, and `ExtractedTablePlayersSchema.seats` carries `.default([])`.

The two procedures use different transport mechanics — `extractTournamentData` sends a hand-written JSON Schema tool with a forced `tool_choice` and validates `toolUse.input` itself; `extractTablePlayers` uses the SDK's structured-output helper (`messages.parse` + `zodOutputFormat`) and reads `parsed_output` — but the all-optional shape, and therefore the failure model below, is shared.

Consequence: an all-optional schema cannot distinguish "nothing found" from "output cut off". That is exactly what the `stop_reason` gate exists for.

## Truncation failure model

**Both procedures check `stop_reason === "max_tokens"` (`assertNotTruncated`) BEFORE any schema validation** — before `safeParse` in `extractTournamentData`, before reading `parsed_output` in `extractTablePlayers`. A truncated response is rejected even when it passes the schema, because it is incomplete.

Why this ordering is load-bearing:

- **Truncation is a realistic failure path.** Thinking shares `max_tokens` with the response text (ON by default since Opus 5), so exhausting the budget cuts structured output mid-stream.
- **Truncation is invisible to parsing.** It happens regardless of whether a `tool_use` block comes back and regardless of whether parsing succeeds: on truncation the `tool_use` block itself is returned, but its `input` is cut off mid-way — so it must be distinguishable from a schema mismatch.
- **Truncated output is frequently schema-valid.** Every field of `ExtractedTournamentDataSchema` is `.optional()`, so a partially-filled input — in the extreme, `{}` — still passes `safeParse`. `blindLevels` is the only variable-length field that can eat `max_tokens`, so the most common truncation shape is a schema-valid "array filled only part-way": without checking `stop_reason` first, a blind structure would be saved silently incomplete. All-fields-optional also means even `{}` parses successfully — a worse outcome than an "extracted but empty" error.
- **The seating schema fails the same way.** `seats` has `.default([])`, so output mangled by truncation could still pass as a successful "table with only empty seats". Checking `stop_reason` first also avoids depending on how the SDK happens to handle incomplete JSON.

Regression coverage: [`packages/api/src/__tests__/ai-extract-truncation.test.ts`](../../packages/api/src/__tests__/ai-extract-truncation.test.ts).

### Truncation vs. missing structured output

Truncation and "the model returned no structured output" have different causes and different remedies, so they are reported as **separate errors**:

| Failure | Error | Remedy direction |
|---|---|---|
| `stop_reason === "max_tokens"` | `AI response was truncated (max_tokens reached)` | Budget: raise `EXTRACTION_MAX_TOKENS` / shrink input. |
| No `tool_use` block / null `parsed_output`, for any non-truncation reason | `AI did not return structured data` (`missingStructuredOutputError`) | Model/prompt behavior, not budget. |

Collapsing them into one error would hide which knob to turn.

## Merging extracted data into the tournament form (SA2-77)

[`apps/web/src/features/rooms/utils/merge-extracted-tournament-data.ts`](../../apps/web/src/features/rooms/utils/merge-extracted-tournament-data.ts) merges AI-extracted tournament data over the values the user has already entered (`base`). Blank extracted values never overwrite an existing value — only meaningful values are applied.

- **AI-blank fields are ignored** so they never overwrite information the user has already entered (SA2-77). A string counts as blank when it is empty after trim (`hasText`).
- **An explicit 0 is not blank — for fields where 0 is real.** Only non-negative finite numbers are valid; an explicit 0 (e.g. a freeroll's `buyIn` / `entryFee`) is distinguished from blank and applied (SA2-77). But `startingStack` / `tableSize` real values are always positive, so for those fields 0 is ignored as AI filler.
- **Non-AI fields carried on `base`** (`bountyAmount` / `currencyId` / `memo` / `tags`) are preserved as-is.

### The merge base is the current form values, not `initialFormValues`

So that a blank AI result never overwrites what the user has typed *during* the session, the merge base is the form's **live** values at extraction time (SA2-77). [`use-tournament-form-sheet.ts`](../../apps/web/src/features/rooms/components/tournament-form-sheet/use-tournament-form-sheet.ts) holds a getter ref (`registerLiveValues`); [`tournament-modal-content.tsx`](../../apps/web/src/features/rooms/components/tournament-modal-content/tournament-modal-content.tsx) and [`tournament-form.tsx`](../../apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/tournament-form.tsx) thread it down to the form, and [`use-tournament-form.ts`](../../apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/use-tournament-form.ts) converts the form's internal values (all strings) into the partial values used as the merge base. Merging over `initialFormValues` instead would silently wipe anything entered after the sheet opened whenever the AI returned blanks.
