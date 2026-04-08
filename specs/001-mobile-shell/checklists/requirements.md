# Requirements Checklist: 001-mobile-shell

**Iteration**: current sync
**Date**: 2026-04-08

## Checklist

- [x] 実装詳細ではなく、現在の shell 挙動を説明している
- [x] モバイルとデスクトップの表示差分が current codebase と一致している
- [x] 5 スロットのモバイルナビと中央アクションが明記されている
- [x] active session によるモバイルのルート項目切替が明記されている
- [x] デスクトップの固定サイドバーとフッター controls が明記されている
- [x] `/login` が共通 shell の外であることが明記されている
- [x] active session によるモバイル中央アクション切替が明記されている
- [x] `DevtoolsToggle` と固定ナビの干渉回避が明記されている
- [x] `md` ブレークポイント基準が current implementation と一致している

## Ambiguity Scan Results

| Category | Status | Notes |
|----------|--------|-------|
| Functional Scope & Behavior | Clear | 現行 shell の mobile / desktop / login 分離を反映済み |
| Routes & Entry Points | Clear | 認証済み画面は shell、`/login` は shell 外 |
| Interaction & UX Flow | Clear | ルート遷移、action 切替、active session の項目差し替えを反映済み |
| Non-Functional Quality | Clear | テーマトークンと固定配置のみを要求している |
| Integration & Dependencies | Clear | `DevtoolsToggle`、`OnlineStatusBar`、`LiveStackFormSheet` を反映済み |
| Terminology & Consistency | Clear | `AuthenticatedShell`、`NavigationItem`、`NavigationCenterAction` で統一 |

## Result

**PASS** - `specs/001-mobile-shell` は current implementation に同期済み。
