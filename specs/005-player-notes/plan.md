# Implementation Plan: プレイヤーメモ機能

**Branch**: `005-player-notes` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)

## Summary

この feature は `Players` 画面を中心に実装済みで、プレイヤー CRUD、タグ CRUD、タグによる絞り込み、HTML メモ編集を一つの流れで提供している。実装の中心は `packages/db/src/schema/player.ts`、`packages/api/src/routers/player*.ts`、`apps/web/src/components/players/*`、`apps/web/src/routes/players/index.tsx`。

## Current Architecture

- `packages/db/src/schema/player.ts` に `player`、`playerTag`、`playerToPlayerTag` を定義し、`packages/db/src/schema.ts` から再エクスポートしている。
- `packages/api/src/routers/player.ts` は一覧、詳細取得、作成、更新、削除を担当し、`playerTag.ts` はタグの一覧、作成、更新、削除を担当する。
- `apps/web/src/routes/players/index.tsx` は一覧、作成/編集ダイアログ、タグ管理ダイアログ、タグ絞り込みをまとめる。
- `apps/web/src/components/players/player-form.tsx` は名前、タグ、メモを同一フォームで編集する。
- `apps/web/src/components/ui/rich-text-editor.tsx` が HTML メモ入力を支え、`player-card.tsx` がメモの安全なプレビューを表示する。

## Validation Notes

- タグ色はプリセットカラーのみを許可する。
- プレイヤー名とタグ名の長さ制約は API 側で検証する。
- タグ削除時は関連する `playerToPlayerTag` を外し、プレイヤー一覧が壊れないことを確認する。
- メモは HTML として保存されるが、一覧表示ではサニタイズした抜粋のみを描画する。

## Assumptions

- 追加の機能分割や新規ページは不要で、現行の `Players` 画面を継続利用する。
- この feature のドキュメントは実装追従を目的とし、未実装の理想仕様は含めない。
