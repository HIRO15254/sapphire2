# Tasks: プレイヤーメモ機能

**Input**: Current implementation under `/specs/005-player-notes/`
**Status**: All implementation tasks completed and synced to the current codebase

## Completed Implementation Inventory

- [x] `packages/db/src/schema/player.ts` defines `player`, `playerTag`, and `playerToPlayerTag` with user ownership, preset tag colors, and a `position` column for tag order
- [x] `packages/db/src/schema.ts` re-exports the player-related tables and relations
- [x] `packages/api/src/routers/player.ts` provides list, getById, create, update, and delete procedures with tag mapping
- [x] `packages/api/src/routers/player-tag.ts` provides list, create, update, and delete procedures for shared tags
- [x] `packages/api/src/routers/index.ts` registers `player` and `playerTag` on `appRouter`
- [x] `apps/web/src/routes/players/index.tsx` wires the page together with player CRUD, tag management, and tag filtering
- [x] `apps/web/src/components/players/player-form.tsx` handles player name, tag selection, and HTML memo editing in one form
- [x] `apps/web/src/components/players/player-card.tsx` shows tags, memo presence, and a sanitized memo preview
- [x] `apps/web/src/components/players/player-tag-manager.tsx` supports tag create, update, and delete flows
- [x] `apps/web/src/components/players/player-tag-input.tsx` and `player-filters.tsx` support shared tag selection and list filtering
- [x] `apps/web/src/components/players/color-badge.tsx` renders the preset tag palette consistently

## Cross-Cutting Notes

- Tag deletion clears player-tag links through the API and updates the list view.
- Memo content is preserved as HTML and displayed through a safe preview path.
- Current UI copy is English-only and follows the existing `Players` page layout.
