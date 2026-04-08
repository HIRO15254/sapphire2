# Implementation Plan: レスポンシブ App Shell

**Branch**: `001-mobile-shell` | **Date**: 2026-04-08 | **Spec**: `specs/001-mobile-shell/spec.md`
**Input**: Current codebase implementation

## Summary

認証済み画面は `AuthenticatedShell` で共通化され、モバイルでは固定ボトムナビ、デスクトップでは固定サイドナビを表示する。ナビ定義は `app-navigation.tsx` に集約され、pathname と active session 状態に応じて表示とアクションが切り替わる。`/login` は shell 外で表示され、モバイルのルート項目は active session に応じて `Sessions` 系と `Events` / `Overview` 系を切り替える。

## Current Structure

- `apps/web/src/components/app-navigation.tsx`: 共有ナビ定義、active 判定、モバイル中央アクション
- `apps/web/src/components/mobile-nav.tsx`: 5 スロットの固定ボトムナビ
- `apps/web/src/components/sidebar-nav.tsx`: 固定サイドナビとフッターの `UserMenu` / `ModeToggle`
- `apps/web/src/components/authenticated-shell.tsx`: `OnlineStatusBar`、左右余白/下部余白、`LiveStackFormSheet`
- `apps/web/src/routes/__root.tsx`: 認証済みページへの shell 適用と `/login` の分岐

## Design Notes

- モバイルは `md:hidden`、デスクトップは `hidden md:flex` で切り替える
- モバイル中央スロットは route ではなく action として扱う
- サイドバーは `bg-sidebar` 系トークンを使い、テーマ切替に追従する
- `DevtoolsToggle` は shell の外側に置かれ、ナビゲーションと独立して操作できる

## Test Plan

- モバイル幅で 5 スロットが表示されることを確認する
- デスクトップ幅でサイドバーとフッター controls が表示されることを確認する
- `/login` で共通 shell が出ないことを確認する
- active session の有無で中央アクションが `New` / `Stack` に切り替わることを確認する

## Assumptions

- 仕様の最新化対象は `specs/001-mobile-shell` のみ
- 現行実装に合わせるため、未実装の理想要件は残さない
- モバイルとデスクトップの境界は Tailwind `md` を基準とする
