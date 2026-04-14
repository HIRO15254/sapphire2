# sapphire2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-11

## Active Technologies
- TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM (008-session-bb-bi-display)
- Cloudflare D1 (SQLite) — 変更なし (008-session-bb-bi-display)
- TypeScript (strict mode) + tRPC v11, Hono, Drizzle ORM, Zod (009-session-recalculation-redesign)
- TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui (Accordion, ResponsiveDialog, Badge), Tailwind v4, tRPC v11, Hono, Drizzle ORM (009-update-notes-display)
- Cloudflare D1 (SQLite) via Drizzle ORM — `update_note_view` テーブルを追加 (009-update-notes-display)
- TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM, Zod (011-redesign-session-events)
- Cloudflare D1 (SQLite) via Drizzle ORM — セッションイベントデータマイグレーション (011-redesign-session-events)
- TypeScript (strict mode) + React 19, Tailwind v4, Radix UI, Vitest, Testing Library (007-improve-tag-colorpicker)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript (strict mode): Follow standard conventions

## Recent Changes
- 011-redesign-session-events: Added TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM, Zod
- 009-update-notes-display: Added TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui (Accordion, ResponsiveDialog, Badge), Tailwind v4, tRPC v11, Hono, Drizzle ORM
- 009-session-recalculation-redesign: Added TypeScript (strict mode) + tRPC v11, Hono, Drizzle ORM, Zod
- 008-session-bb-bi-display: Added TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM

- 007-improve-tag-colorpicker: Added TypeScript (strict mode) + React 19, Tailwind v4, Radix UI, Vitest, Testing Library

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
