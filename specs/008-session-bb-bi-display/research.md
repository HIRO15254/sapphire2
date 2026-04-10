# Research: セッション一覧のBB/BI単位表示

**Feature**: 008-session-bb-bi-display
**Date**: 2026-04-10

## Research Tasks

### R1: session.list APIレスポンスにblind2を含める方法

**Decision**: session.list の SELECT にて、既にJOINしている `ringGame` テーブルから `ringGame.blind2` を追加取得し、レスポンスに含める。

**Rationale**: 
- session.list クエリは既に `ringGame` テーブルを `leftJoin` している（`packages/api/src/routers/session.ts:856`）
- `ringGameName: ringGame.name` は既に取得済み → `ringGameBlind2: ringGame.blind2` を追加するだけで良い
- 追加クエリやJOINは不要で、パフォーマンス影響なし

**Alternatives considered**:
- フロントエンドで個別にringGameをfetchする → 不要なAPIコール増加、却下
- BB/BI変換をAPI側で行う → フロントエンドのUI状態（トグル）でAPI呼び出しが変わるのは不適切、却下

### R2: BB/BI値の表示フォーマット

**Decision**: 小数第1位まで固定表示（`toFixed(1)`）。単位は値の後に半角スペース + "BB" or "BI"。

**Rationale**:
- ポーカーコミュニティでの慣習的な表記法に準拠（例: +25.3 BB, -1.7 BI）
- `formatCompactNumber` は大きな数値のk/M/B変換用であり、BB/BI値は通常小さい数値（-100〜+100程度）なので不要
- 小数第1位で十分な精度（blind2=200でP&L=150の場合、0.75→0.8と表示）

**Alternatives considered**:
- 小数第2位まで表示 → 過剰な精度、UIが煩雑になる
- `formatCompactNumber` を流用 → BB/BI値は通常小数を含むため、整数向けのcompact表記は不適

### R3: トグルUIの配置と実装

**Decision**: セッション一覧ページ上部のアクション領域（`PageHeader` の `actions` prop 内）に、shadcn/ui の `Switch` コンポーネントを配置する。ラベルは "BB/BI"。

**Rationale**:
- 既存のフィルターボタンとNew Sessionボタンの間に配置可能
- `Switch` はオン/オフのバイナリ状態に最適なUIコンポーネント
- 既存の `PageHeader` > `actions` パターンに沿う

**Alternatives considered**:
- フィルターダイアログ内にBB/BIオプションを追加 → 頻繁に切り替えるため、ダイアログ内は不便
- ToggleGroupで "Chips / BB/BI" を選択 → 過剰なUI要素、シンプルなSwitchで十分

### R4: BB/BIモード状態の受け渡し

**Decision**: セッション一覧ページ（`routes/sessions/index.tsx`）に `useState<boolean>(false)` として `bbBiMode` を管理し、`SessionCard` コンポーネントに `bbBiMode` prop として渡す。

**Rationale**:
- トグル状態は単一ページ内で完結するローカルstate
- SessionCardに追加propとして渡すのが最もシンプル
- Contextは不要（1段階の受け渡しのみ）

**Alternatives considered**:
- React Context → 1段階のprop渡しでは不要、過剰
- URLパラメータ → ページリロードやシェア時の永続化は本スコープ外
- Zustand等のグローバルstate → 過剰

### R5: TourneyのBI計算式の確認

**Decision**: BI = profitLoss / totalCost。totalCost = tournamentBuyIn + entryFee + (rebuyCount × rebuyCost) + addonCost。各nullフィールドは0として扱う。

**Rationale**:
- 既存の `computeTournamentPL` 関数（`session.ts:54-70`）と同じcost計算ロジックを使用
- profitLossは既にAPI側で計算済みなので、フロントエンドではtotalCostの再計算のみ必要
- BI単位表示のためにはtotalCostをフロントエンドで再計算する必要がある（APIはtotalCostを返していない）

**Alternatives considered**:
- APIにtotalCostフィールドを追加して返す → 可能だがtourneyの各フィールドは既にレスポンスに含まれるため、フロントで計算可能。不要なAPI変更を避ける
- profitLoss / tournamentBuyInのみ（entryFee等を除外）→ Issueの要求は「総バイインで割る」であり、全コストを含めるべき

### R6: SessionItemの型拡張

**Decision**: 既存の `SessionItem` インターフェース（`use-sessions.ts`）と `SessionCardProps` に `ringGameBlind2: number | null` フィールドを追加する。

**Rationale**:
- APIレスポンスに追加されるblind2をフロントエンド側の型に反映する必要がある
- 既存の命名規則に従い、`ringGameName` と並列で `ringGameBlind2` とする
- nullableにすることで、ringGameが未リンクまたはblind2未設定のケースを自然に扱える

**Alternatives considered**:
- blind2を別途取得する仕組み → 不要、session.listに含める方がシンプル
