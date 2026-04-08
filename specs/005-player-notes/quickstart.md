# Quickstart: プレイヤーメモ機能

## Prerequisites

- Bun runtime installed
- Repository cloned and dependencies installed with `bun install`
- Authentication configured so the `Players` page can be opened

## Using the Feature

1. Start the app with `bun run dev`.
2. Open the `Players` page in the web app.
3. Use `New Player` to create a player with a name, optional tags, and an optional memo.
4. Use `Manage Tags` to create, edit, or delete shared tags.
5. Use the tag filter button to narrow the player list by one or more tags.
6. Open an existing player in edit mode to update the name, tags, or memo.

## Relevant Files

- `apps/web/src/routes/players/index.tsx`
- `apps/web/src/components/players/player-form.tsx`
- `apps/web/src/components/players/player-card.tsx`
- `apps/web/src/components/players/player-tag-manager.tsx`
- `apps/web/src/components/players/player-filters.tsx`
- `apps/web/src/components/ui/rich-text-editor.tsx`
- `packages/api/src/routers/player.ts`
- `packages/api/src/routers/player-tag.ts`
- `packages/db/src/schema/player.ts`

## Validation

```bash
bun run test
bun run check-types
```

## Notes

- Memo content is saved as HTML and rendered in a sanitized preview on the player card.
- Tag colors come from the preset palette defined in `packages/db`.
- The current UI uses English labels throughout the `Players` workflow.
