---
name: create-update-notes
description: Draft a GitHub release note (update note) for sapphire2 from PRs merged since the latest tag, following the style of past sapphire2 releases, and publish it as a draft release. Use when the user asks to create release notes, update notes, or publish a new version, or invokes `/create-update-notes`.
---

## User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` is expected to contain the new version number (e.g. `v1.4.0`). If empty, ask the user once at the first step.

## Goal

Produce an update note for sapphire2 in the exact tone and structure of past releases (v1.1.0 / v1.2.0 / v1.3.0), then register it as a draft GitHub Release on `HIRO15254/sapphire2`. Return the resulting URL and the final Markdown body to the user.

## Fixed Structure

```markdown
## vX.Y.Z Release Notes

### New Features

- <user-facing sentence> (#PR)

### UI Improvements

- <user-facing sentence> (#PR)

### Bug Fixes

- Fixed <symptom> (#PR)
```

- Drop a section entirely if it has zero items.
- Keep heading levels (`##` / `###`) identical to past notes.

## Style Rules — User-Facing Only

**These rules are non-negotiable. Every bullet must pass them.**

1. **Write from the user's point of view.** Describe what the user can now do, see, or no longer has to worry about — not what the code does.
   - Do NOT mention: file names, class names, table names, router / mutation / hook / component / schema names, refactors, internal types, migrations, tRPC procedures, Drizzle models, tests, tooling, or any other implementation detail.
   - Translate any implementation term into the UI surface or the user action it affects (e.g. "update the `sessionEvent` router" → name the screen or action that changed).
2. **For New Features, lead with the capability.** Start each bullet by saying what the user can now accomplish, not what was "added" in the abstract.
   - Prefer: "Players can now seat themselves from a screenshot of the waiting list" over "Waiting-list screenshot OCR added".
   - Prefer: "Dashboard widgets can be rearranged per device" over "Customizable dashboard layout".
3. **For UI Improvements, describe what the user sees or how the flow is smoother.** Avoid the words "refactor" / "cleanup" / "internal".
4. **For Bug Fixes, start with `Fixed`** and describe the observable symptom that went away.
5. **One line per item. No trailing period.** (Matches past notes.)
6. **Append the PR reference** as `(#123)`; combine related PRs as `(#123, #124)`.
7. **Write in English.** Past notes are in English; keep the style consistent.
8. **Keep it concise. Do not enumerate sub-components.** Name what changed at the highest level the user recognises and stop. Skip column counts, the full list of fields shown, internal layout terms, and other micro-detail.
   - Target ~40–80 characters before the `(#...)` suffix.
   - If the user would need to read the PR to understand the bullet, it is too detailed; shorten it.
9. **Break a single PR into multiple bullets only when it shipped several clearly distinct user-visible changes** (e.g. a new feature plus an unrelated bug fix).
10. **Exclude unless they change user experience**: dependency bumps, version-bump PRs, pure refactors, test-only, docs-only, CI-only, bot PRs, internal renames.

### Good examples (one per category)

```
- AI-powered tournament data extraction from tournament URLs and images (#154)
- Live session header summary redesigned (#185, #190)
- Fixed HTML parsing errors in Cloudflare Workers (#154)
```

Note: past notes occasionally went too deep (e.g. enumerating a 3-column layout and every field it shows). Prefer the shorter phrasing above — past notes are guidance, not a ceiling on brevity.

### Contrast examples (reject → rewrite)

- Reject: "Refactored session event router to use discriminated unions (#111)"
  → Rewrite as UI Improvement: "Live session state stays consistent after reconnect (#111)"
- Reject: "Added `update_note_view` table and tRPC procedure (#99)"
  → Rewrite as New Feature: "In-app update notes panel shows what's new on each release (#99)"
- Reject: "Fixed useMutation race condition in stack editor (#113)"
  → Rewrite as Bug Fix: "Fixed stack edits sometimes reverting when tapped quickly (#113)"
- Reject (too detailed): "Live session header redesigned with 3-column layout showing time, field/entries, and P&L/avg stack (#185, #190)"
  → Rewrite: "Live session header summary redesigned (#185, #190)"

When in doubt between UI Improvement and Refactor, ask: would a user notice this change if they opened the app? If no, drop it. When in doubt about length, cut.

## Execution Flow

### 1. Decide the version number

1. Extract `vX.Y.Z` from `$ARGUMENTS`. If missing or malformed, ask the user once: "What is the new version number? (e.g. v1.4.0)".
2. Call `mcp__github__get_latest_release` on `HIRO15254/sapphire2` and store the tag as `PREV_TAG`.
3. Confirm the new version moves forward in semver. If it is equal to, older than, or already exists as `PREV_TAG`, ask the user to confirm.

### 2. Determine the PR range

```bash
git fetch --tags origin
git log --first-parent "${PREV_TAG}..origin/main" --format='%s'
```

- Extract PR numbers via the regex `#(\d+)` and deduplicate.
- If zero PRs come back, fall back to `git log "${PREV_TAG}..origin/main" --format='%s'`.
- Handle both merge-commit subjects (`Merge pull request #NNN from ...`) and squash-merge subjects (`Title (#NNN)`).

### 3. Fetch PR details

For each PR number, call `mcp__github__pull_request_read` with `method: "get"` and collect `title`, `body`, `labels`, `state`, `user.login`. These fetches are independent — run them in parallel.

Exclude a PR if:

- `user.login` is `dependabot[bot]`, `renovate[bot]`, or similar bot.
- `title` matches a release/version-bump pattern (`Release vX.Y.Z`, `chore(release): ...`).
- An explicit skip label exists (e.g. `ignore-release-notes`).
- The change is pure refactor / test-only / docs-only / CI-only with no visible user effect.

### 4. Classify (LLM inference)

Assign each PR to New Features / UI Improvements / Bug Fixes. Flag uncertain ones internally as `[needs review]` to surface during the review step.

Hints:

- Conventional prefix in `title`: `feat:` → Features, `fix:` → Bug Fixes, `refactor:` / `chore:` → usually excluded.
- Labels: `enhancement` → Features or UI, `bug` → Bug Fixes, `ui` / `design` → UI Improvements.
- Body keywords: "redesign" / "layout" / "rework" / "UX" → UI; "broken" / "regression" / "wasn't" → Bug Fixes; "add" / "support for" / "new" → Features.

### 5. Draft the one-line summary

For each PR:

1. Strip conventional prefixes (`feat:`, `fix:`, scopes) from the title.
2. Read the body's first paragraph / Summary section to identify the user-visible change.
3. Apply the Style Rules above. For New Features, rewrite until the sentence starts from what the user can now do. For UI Improvements, rewrite until the sentence describes what the user sees or feels. For Bug Fixes, rewrite until it starts with `Fixed` and names the symptom.
4. **Trim aggressively.** Remove enumerations, column counts, exhaustive field lists, and internal layout words. If the sentence could be halved without losing its meaning to a user, halve it.
5. Append `(#PR)`. Collapse sibling PRs into `(#123, #124)`.
6. Split a PR into multiple bullets only when it shipped several clearly distinct user-visible changes.

### 6. Review with the user

Present the assembled Markdown in a fenced code block and ask the user, in a single round-trip:

1. Are the classifications correct (especially `[needs review]` items)?
2. Should any excluded PR be added back? (Show the exclusion list too.)
3. Any wording to adjust?
4. Final confirmation of version number / tag / title.

Apply edits and iterate until approved (max 3 rounds).

### 7. Create the draft release

After approval, post to the GitHub API directly (MCP has no `create_release` tool):

```bash
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN is not set; skipping automated draft creation"
else
  curl -sS -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/HIRO15254/sapphire2/releases \
    -d @/tmp/release-body.json
fi
```

Write `/tmp/release-body.json` as:

```json
{
  "tag_name": "vX.Y.Z",
  "target_commitish": "main",
  "name": "vX.Y.Z",
  "body": "...<final Markdown>...",
  "draft": true,
  "prerelease": false
}
```

- On success, display the response's `html_url` to the user.
- If `GITHUB_TOKEN` is unset, or the API returns 4xx, fall back to a pre-filled manual URL: `https://github.com/HIRO15254/sapphire2/releases/new?tag=<vX.Y.Z>&title=<vX.Y.Z>&body=<urlencoded>`.
- Either way, always print the final Markdown body to the user.

## Output

Return to the user:

1. Draft Release URL (auto-created) or the manual-creation URL (fallback).
2. The full final Markdown body.
3. A short list of PR numbers that were excluded (if any).

## Notes

- This skill only drafts the release body. It does not bump `package.json`, update `CHANGELOG.md`, push tags, or publish a non-draft release.
- The skill must never `git push` on its own or create a release with `draft: false`. The user publishes the draft themselves.
- When the format of past releases changes, update both the "Fixed Structure" and the "Good examples" blocks above.
