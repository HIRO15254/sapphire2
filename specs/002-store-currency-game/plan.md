# Documentation Sync Plan: 店舗・通貨・ゲーム設定マスターデータ管理

**Branch**: `002-store-currency-game` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)

## Summary

この feature はすでに実装済みであり、計画書は現行の実装構成を説明する役割に絞る。
対象は `Stores` / `Currencies` / `Settings` の画面と、店舗詳細の `Cash Games` / `Tournaments` タブ、そして API / schema の対応関係。

## Current Structure

- **Web**: `apps/web/src/routes/stores`, `apps/web/src/routes/currencies`, `apps/web/src/routes/settings`
- **Store detail**: `apps/web/src/routes/stores/$storeId.tsx` で Cash Games / Tournaments を切り替え
- **API**: `store`, `currency`, `transactionType`, `currencyTransaction`, `ringGame`, `tournament`, `blindLevel`, `tournamentChipPurchase`
- **DB**: `store.ts` に通貨・種別・通貨トランザクション、`ring-game.ts` に Cash Game、`tournament.ts` に Tournament / BlindLevel / ChipPurchase、`tournament-tag.ts` にタグ

## Documentation Changes

- `spec.md` は現在の機能範囲に合わせて整理
- `data-model.md` は実スキーマに合わせて更新
- `contracts/trpc-routers.md` は実在 router と CRUD を列挙
- `quickstart.md` は現行コマンドと導線に更新
- `research.md` は実装済みの設計判断のみを残す
- `tasks.md` と `checklists/requirements.md` は完了済みの現状に合わせる

## Assumptions

- コード変更は行わず、ドキュメントのみを更新する
- `Currencies` は独立ページとして扱う
- `TournamentChipPurchase` は Tournament の子データとして明示する
