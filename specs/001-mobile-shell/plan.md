# Implementation Plan: モバイル基本レイアウト（Mobile Shell）— Revision 2

**Branch**: `001-mobile-shell` | **Date**: 2026-03-12 | **Spec**: `specs/001-mobile-shell/spec.md`
**Input**: Feature specification (Revision 2) from `/specs/001-mobile-shell/spec.md`

## Summary

モバイル（767px以下）ではボトムナビゲーション、デスクトップ（768px以上）ではサイドナビゲーションを表示するレスポンシブシェルを実装する。既存のヘッダーナビゲーションは削除し、全機能をボトム/サイドナビに統合する。Tabler Icons + テキストラベル、shadcn/ui テーマとの一貫性、ダークモード追従、開発ツール非干渉を実現する。

## Technical Context

**Language/Version**: TypeScript (strict mode), React 19
**Primary Dependencies**: @tanstack/react-router v1.141, @tabler/icons-react v3.39 (installed), Tailwind CSS v4, shadcn/ui
**Storage**: N/A（フロントエンドのみ）
**Testing**: Vitest + Testing Library + jsdom
**Target Platform**: モバイル・デスクトップ Web ブラウザ
**Project Type**: Web application (monorepo)
**Constraints**: 追加パッケージ不要、既存の依存関係のみで実装可能

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ Pass | NavigationItem 型を定義、props に明示的な型付け |
| II. Monorepo Package Boundaries | ✅ Pass | apps/web 内のみの変更 |
| III. Test Coverage Required | ✅ Pass | コンポーネントテスト（Testing Library + jsdom） |
| IV. Code Quality Automation | ✅ Pass | Biome/Ultracite で自動フォーマット |
| V. API Contract Discipline | ✅ N/A | API 変更なし |
| YAGNI | ✅ Pass | 必要最小限のコンポーネント構成 |

## Project Structure

### Source Code Changes

```text
apps/web/src/
├── components/
│   ├── mobile-nav.tsx          # [MODIFY] 等間隔配置、テーマ統一、z-index調整
│   ├── sidebar-nav.tsx         # [NEW] デスクトップ向けサイドナビゲーション
│   ├── header.tsx              # [DELETE] ヘッダーナビゲーション削除
│   ├── user-menu.tsx           # [KEEP] サイドナビに移動して使用
│   └── mode-toggle.tsx         # [KEEP] サイドナビに移動して使用
├── routes/
│   └── __root.tsx              # [MODIFY] レイアウト再構成（ヘッダー削除、サイドナビ追加）
└── __tests__/
    └── mobile-nav.test.tsx     # [MODIFY] テスト更新
```

## Design Decisions

### ナビゲーション項目

**ボトムナビゲーション（モバイル）**: 5項目

| # | ラベル | パス | アイコン |
|---|--------|------|----------|
| 1 | ホーム | `/` | IconHome |
| 2 | ダッシュボード | `/dashboard` | IconLayoutDashboard |
| 3 | Todo | `/todos` | IconChecklist |
| 4 | 検索 | `/search` | IconSearch |
| 5 | 設定 | `/settings` | IconSettings |

**サイドナビゲーション（デスクトップ）**: 同じ5項目 + ユーザーメニュー/テーマ切替をフッター部分に配置

### レイアウト構成

**モバイル（<768px）**:
```
┌─────────────────┐
│   Content Area   │
│   (pb-16)        │
├─────────────────┤
│  Bottom Nav (5)  │  ← fixed bottom, z-40
└─────────────────┘
```

**デスクトップ（≥768px）**:
```
┌──────┬──────────────┐
│ Side │  Content     │
│ Nav  │  Area        │
│      │              │
│ User │              │
│ Menu │              │
└──────┴──────────────┘
```

### レスポンシブ制御

- ボトムナビ: `md:hidden` で768px以上で非表示
- サイドナビ: `hidden md:flex` で768px未満で非表示
- コンテンツ: `pb-16 md:pb-0` (モバイル下部余白), `md:ml-[sidebar-width]` (デスクトップ左余白)

### テーマ一貫性

- shadcn/ui の CSS 変数を使用: `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent` 等
- `bg-sidebar` / `text-sidebar-foreground` で色指定
- ダークモード: CSS 変数がテーマに応じて自動切替

### 開発ツール非干渉

- TanStack Router Devtools: `position="bottom-left"` → モバイルのボトムナビと干渉する可能性あり
  - 対策: ボトムナビの z-index を z-40 に設定（devtools のデフォルト z-index より低め）
  - devtools のトグルボタンが操作可能なことを確認
- React Query Devtools: `position="bottom"`, `buttonPosition="bottom-right"` → 同様に z-index で共存

### ヘッダー削除

- `header.tsx` を削除（またはナビリンク部分のみ削除）
- UserMenu と ModeToggle はサイドナビのフッター部分に移動
- `__root.tsx` から Header コンポーネントの参照を削除

## Complexity Tracking

> 違反なし
