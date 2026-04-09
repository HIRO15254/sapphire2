---
name: release-metadata-claude
description: Create release metadata JSON for a feature branch, staging merge, or hotfix. Use when Claude needs to summarize one PR as a single schema-valid metadata file with the correct major, minor, or fix severity and user or developer scope.
---

# Release Metadata For Claude

Read [`../release-metadata-references/rules.md`](../release-metadata-references/rules.md) first.

## Task

Produce one metadata JSON file per PR for `.release/pending/`.

## Instructions

- Write in English.
- Output one JSON object only.
- Choose one `type` for the whole PR: `major`, `minor`, or `fix`.
- Choose one `scope` for the whole PR: `user` or `developer`.
- Add `additions` only when short extra bullets improve release notes quality.
- Keep `title` short and release-note friendly.
- Keep `summary` to one clear sentence.

## Decision Rules

- `major`: breaking, migration-requiring, or incompatible change.
- `minor`: new capability or meaningful non-breaking enhancement.
- `fix`: bug fix, correction, or maintenance improvement.
- `user`: visible product or UX change.
- `developer`: CI, tooling, infra, refactor, or internal workflow change.

## Output Template

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

## Common Mistakes

- Do not emit multiple objects.
- Do not add extra keys.
- Do not mark internal work as `user`.
- Do not use `major` for ordinary features.
- Do not create more than one metadata file for a single PR.
