---
name: release-metadata-codex
description: Create or update release metadata JSON for a feature, fix, or hotfix destined for staging or main. Use when Codex needs to classify a PR change as major, minor, or fix, decide whether the impact is user or developer, and produce a single schema-valid metadata file under .release/pending.
---

# Release Metadata For Codex

Read [`../release-metadata-references/rules.md`](../release-metadata-references/rules.md) before drafting the file.

## Workflow

1. Inspect the branch diff, changed files, and user request.
2. Decide the single best `type` and `scope` for the whole PR.
3. Write one JSON object only.
4. Save it under `.release/pending/<descriptive-name>.json`.
5. Keep the output schema-valid and English-only.

## Decision Heuristics

- Prefer the highest-impact classification that is still accurate.
- Use `minor` for new features and non-breaking UX additions.
- Use `fix` for corrections, regressions, reliability improvements, and hotfixes.
- Use `major` only when users or integrators must change behavior, expectations, or setup.
- Use `developer` when the shipped effect is CI, tooling, refactor, infrastructure, or internal-only.
- Use `user` when an end user can notice the change in product behavior or UI.

## Output Standard

Return exactly one JSON object:

```json
{
  "title": "Add session tag management",
  "summary": "Users can edit and remove session tags from settings.",
  "changes": {
    "type": "minor",
    "scope": "user",
    "additions": [
      "Inline rename for existing tags",
      "Delete confirmation before removal"
    ]
  }
}
```

## Examples

New visible feature:

```json
{
  "title": "Add release notes modal",
  "summary": "Users now see the latest release notes after logging in to a new version.",
  "changes": {
    "type": "minor",
    "scope": "user"
  }
}
```

Internal automation:

```json
{
  "title": "Automate release summary generation",
  "summary": "The release pipeline now validates metadata and prepares summary files for main PRs.",
  "changes": {
    "type": "minor",
    "scope": "developer",
    "additions": [
      "Validates release metadata on staging PRs",
      "Generates grouped release notes for GitHub releases"
    ]
  }
}
```

Bug fix:

```json
{
  "title": "Fix release note version tracking",
  "summary": "The app now records the last viewed release version correctly after users close the modal.",
  "changes": {
    "type": "fix",
    "scope": "user"
  }
}
```
