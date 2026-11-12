# AI Extraction

Historical context is preserved in the [archive](../archive/ai-extraction-history.md).

This document covers the protected `aiExtractRouter` procedures in [`packages/api/src/routers/ai-extract.ts`](../../packages/api/src/routers/ai-extract.ts): `extractTournamentData` extracts tournament details, and `extractTablePlayers` extracts seated players. Both accept one to five base64-encoded JPEG, PNG, GIF, or WebP images; URL sources are rejected. Both require `OPENAI_API_KEY` in the request context.

Both procedures build the OpenAI client through `createExtractionClient`: a 180-second timeout per attempt and one automatic retry. The SDK default (600 seconds, two retries) could hold one request and its paid provider calls for about 30 minutes. 180 seconds is sized to leave room for a full `EXTRACTION_MAX_OUTPUT_TOKENS` generation including reasoning, and the single retry absorbs a transient 429/5xx; a timeout surfaces as an error the user may retry.

## Model registry (`AI_MODELS`)

The imperatives around model IDs — single home in `models.ts`, no runtime "latest" resolution, `max_output_tokens` must include the reasoning budget, upgrade checklist — live in [`.claude/rules/ai-models.md`](../../.claude/rules/ai-models.md). This section records only the registry contents and how the rule is enforced.

Enforcement is deliberately split across three mechanisms, which is why [`models.test.ts`](../../packages/api/src/ai/__tests__/models.test.ts) asserts only `EXTRACTION_MAX_OUTPUT_TOKENS`:

- That every `AI_MODELS` entry is `LATEST_MODEL` is guaranteed **at the type level** by `satisfies Record<string, typeof LATEST_MODEL>` in `models.ts`.
- That call sites never hard-code `gpt-*` literals is guaranteed by [`scripts/check-rules.ts`](../../scripts/check-rules.ts) — the OpenAI SDK's model type is a loose union including `string & {}`, so the type checker alone catches neither typos nor stale model IDs.
- The one plain runtime value left, `EXTRACTION_MAX_OUTPUT_TOKENS` (currently 8192), is covered by the test.

`EXTRACTION_MAX_OUTPUT_TOKENS` is the output cap for both extraction requests. It is sized well above the realistic output size because `max_output_tokens` bounds reasoning **plus** response text, and only generated tokens are billed — headroom is free, while a tight cap turns into the truncation failure below.

`LATEST_MODEL` pins `gpt-5.6-luna` rather than resolving a model alias at runtime. Both extraction procedures use that pin.

## Structured output and application contracts

Both procedures call `client.responses.parse()` with `text.format: zodTextFormat(...)`. The tournament wire schema uses nullable fields for values the model cannot find; its descriptions instruct the model not to invent them. After parsing, `withoutNulls` recursively removes null-valued object properties and `ExtractedTournamentDataSchema.safeParse` validates the result. Top-level tournament fields are optional, including the chip-purchase and blind-level arrays; nested chip purchases require name, cost and chips, while blind levels require `isBreak` and allow optional nullable blind and duration values.

Table-player extraction instead uses `TABLE_PLAYERS_OUTPUT_SCHEMA` directly: each returned seat has a bounded seat number, nonempty name and nullable `isHero`. It keeps the first occurrence of each seat number. The only supported source app is `dmm_waitinglist`; its [prompt](../../packages/api/src/routers/ai-extract-sources.ts) specifies numbering, readable names and hero detection.

The wire schemas' `.describe()` strings are prompt data. Zod parsing also checks numeric bounds and other constraints. The tournament contract is validated again after null removal to guard against drift between the wire and application schemas.

## Truncation failure model

**Both procedures run `assertNotTruncated(response)` before consuming `output_parsed`** and, for tournament data, before validating the app contract. The SDK parses the structured response inside `responses.parse()`, so a parsing error can occur before this status check.

Why this ordering is load-bearing:

- **Truncation is a realistic failure path.** Reasoning shares `max_output_tokens` with the response text, so exhausting the budget cuts structured output mid-stream.
- **The guard buys attribution, not rescue.** The SDK parses only a `status: "completed"` response (`shouldParse` in `openai/lib/ResponsesParser`), so `output_parsed` is already null whenever the turn was cut short. Dropping the guard would not leak a half-filled object; it would report every incomplete response as `AI did not return structured data`, which sends the reader at the prompt when the real remedy is the token budget (`max_output_tokens`) or a provider-side stop (`content_filter`, `steered`).
- **The tournament contract cannot tell the two apart on its own.** Every top-level field of `ExtractedTournamentDataSchema` is optional, so `{}` is valid. Checking status preserves the distinction between finding nothing and an incomplete response.

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

## Web integration

The current web application has no `aiExtract` consumer. The former tournament form's merge behavior is described as history in the [archive](../archive/ai-extraction-history.md), not as a current implementation.

## Icon keywords

SA2-453. `aiExtract.suggestIconKeywords` turns a name a user typed (any language) into 3–5 lowercase English words that `useIconSuggestion` feeds into the icon tag search ([web-platform.md](web-platform.md#user-chosen-icons-tablericon-iconpicker)). The model never sees the icon list: the ~5,200 names would cost about 20k input tokens per call, while the name alone is a few dozen.

- The name is the user message, serialized as JSON data; the instructions live in `instructions` and tell the model to treat the name only as something to describe.
- The wire schema is `{ keywords: string[] }`. The router lowercases the words, splits multi-word entries, keeps only `^[a-z][a-z0-9-]{0,29}$`, removes duplicates and caps the list at five, so the output can only ever be search words.
- The client uses `maxRetries: 0` and a 10 s timeout, and `ICON_KEYWORDS_MAX_OUTPUT_TOKENS` (2048) leaves room for reasoning. The web hook swallows every failure: a missing suggestion is not an error.
- It is excluded from MCP: an MCP client is itself an LLM and can choose an icon name directly.
- There is no per-user call limit yet. Calls happen only on a name field's blur when the rules found nothing and the icon is still unset, and results are cached per name in the browser session.
