# Implementation Plan: セッション一覧のBB/BI単位表示

**Branch**: `008-session-bb-bi-display` | **Date**: 2026-04-10 | **Spec**: `/specs/008-session-bb-bi-display/spec.md`
**Input**: Feature specification from `/specs/008-session-bb-bi-display/spec.md`

## Summary

セッション一覧画面にBB/BI表示トグルを追加し、Cash GameセッションのP&L/EVをBB（Big Blind）単位、TourneyセッションのP&LをBI（Buy-In）単位で表示する機能。APIに `ringGame.blind2` をレスポンスに追加し、フロントエンドでBB/BI変換とトグルUIを実装する。DBスキーマ変更は不要。

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM  
**Storage**: Cloudflare D1 (SQLite) — 変更なし  
**Testing**: Vitest, Testing Library  
**Target Platform**: Web (mobile-first)  
**Project Type**: Web application (monorepo: apps/web + apps/server + packages/*)  
**Performance Goals**: トグル切替は追加APIリクエストなし、即座に反映  
**Constraints**: 既存セッション一覧のパフォーマンスを劣化させないこと  
**Scale/Scope**: 影響ファイル6-8件、新規UIコンポーネント1件（Switch）、新規ロジック関数3-4件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | PASS | SessionItem, SessionCardPropsに型追加。変換関数は型付き |
| II. Monorepo Package Boundaries | PASS | API変更は packages/api、UI変更は apps/web で完結 |
| III. Test Coverage Required | PASS | SessionCard コンポーネントテスト、APIルーターテストを追加 |
| IV. Code Quality Automation | PASS | 既存のBiome/Ultraciteに従う |
| V. English-Only UI | PASS | "BB", "BI" はポーカー用語（英語）。トグルラベルも英語 |
| VI. Mobile-First UI Design | PASS | Switch はタッチフレンドリー（44px以上）、モバイルで自然 |
| VII. API Contract Discipline | PASS | 出力フィールド追加のみ、後方互換 |
| VIII. Offline-First Data Layer | PASS | 新規mutation なし。既存のTanStack Queryパターンを踏襲 |

**Gate Result**: PASS — 違反なし

### Post-Phase 1 Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | PASS | blind2 は `number \| null` で適切にnullable |
| II. Monorepo Package Boundaries | PASS | 変更なし |
| III. Test Coverage Required | PASS | テスト計画あり（quickstart.md参照） |
| VII. API Contract Discipline | PASS | 既存SELECTに1フィールド追加、後方互換 |
| YAGNI (Governance) | PASS | サマリーのBB/BI変換は意図的にスコープ外、過剰な機能追加を回避 |

## Project Structure

### Documentation (this feature)

```text
specs/008-session-bb-bi-display/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── session-list-response.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/api/
└── src/
    ├── routers/
    │   └── session.ts              # blind2 をSELECTに追加
    └── __tests__/
        └── session.test.ts         # blind2 返却テスト追加

apps/web/
└── src/
    ├── sessions/
    │   ├── hooks/
    │   │   └── use-sessions.ts     # SessionItem 型に ringGameBlind2 追加
    │   └── components/
    │       ├── session-card.tsx     # BB/BI表示ロジック追加
    │       └── __tests__/
    │           └── session-card.test.tsx  # BB/BI表示テスト追加
    ├── routes/
    │   └── sessions/
    │       └── index.tsx           # トグルUI追加、bbBiMode state管理
    └── shared/
        └── components/
            └── ui/
                └── switch.tsx      # shadcn/ui Switch コンポーネント（新規追加）
```

**Structure Decision**: 既存のモノレポ構造に沿い、packages/api のルーター変更と apps/web のコンポーネント変更で完結。新規ファイルは shadcn/ui Switch コンポーネントのみ。BB/BI変換ロジックは session-card.tsx 内のヘルパー関数として実装し、過度な抽象化を避ける。

## Complexity Tracking

違反なし — 記載不要。

## Implementation Phases

### Phase 1: API — blind2 をレスポンスに追加

1. `packages/api/src/routers/session.ts` の `list` プロシージャSELECTに `ringGameBlind2: ringGame.blind2` 追加
2. `buildOptimisticItem` に `ringGameBlind2: null` 追加
3. APIテスト追加

### Phase 2: フロントエンド型更新

1. `SessionItem` インターフェースに `ringGameBlind2: number | null` 追加
2. `SessionCardProps` の `session` 型に同フィールド追加
3. `buildOptimisticItem` に `ringGameBlind2: null` 追加

### Phase 3: BB/BI変換ロジック + 表示

1. session-card.tsx に BB/BI 変換ヘルパー関数を追加
2. `SessionHeader` でbbBiMode時のP&L表示切替
3. `CashGameDetails` でbbBiMode時のBuy-in/Cash-out/EV表示切替
4. Cash Game の EV P&L 表示も BB 単位対応
5. Tournament の P&L を BI 単位対応

### Phase 4: トグルUI

1. shadcn/ui Switch コンポーネントを追加（`apps/web/src/shared/components/ui/switch.tsx`）
2. `routes/sessions/index.tsx` に bbBiMode state と Switch トグル追加
3. SessionCard に bbBiMode prop を渡す

### Phase 5: テスト

1. SessionCard の BB 表示テスト（Cash Game）
2. SessionCard の BI 表示テスト（Tournament）
3. blind2 null / 0 のフォールバックテスト
4. totalCost 0 のフォールバックテスト
5. トグルオフ時の通常表示テスト
