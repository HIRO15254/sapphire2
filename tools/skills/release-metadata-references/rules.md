# Release Metadata Rules

## Schema

Use exactly one JSON object per PR.

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

## Classification

### `type`

- `major`: Breaking behavior, migration-required changes, or incompatible workflow changes.
- `minor`: New capability, visible enhancement, or significant non-breaking improvement.
- `fix`: Bug fix, polish, or maintenance correction without new capability.

### `scope`

- `user`: End-user visible behavior or UX changes.
- `developer`: Tooling, CI, infra, internal refactor, or developer-only workflow changes.

## Writing Rules

- Write in English.
- Keep `title` short and concrete.
- Keep `summary` to one sentence explaining the shipped outcome.
- Use `additions` only for extra bullets that help release notes readers.
- Omit `additions` when there is nothing useful to add.

## Avoid

- Do not add extra keys.
- Do not turn `additions` into an object.
- Do not use `major` unless the change is genuinely breaking.
- Do not mark internal-only work as `user`.
- Do not split a single PR into multiple metadata files.
