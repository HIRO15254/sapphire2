# Tasks: セッション一覧のBB/BI単位表示

**Input**: Design documents from `/specs/008-session-bb-bi-display/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Constitution III により、全実装タスクに対応するテストが必要。

**Organization**: US1-3（P&L表示）とUS4（トグルUI）は相互依存するため、Foundationalフェーズでインフラ整備後、コア機能を一括で実装する。US5（詳細部BB/BI表示）はUS1-4完了後に追加対応。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: 対応するユーザーストーリー（US1-US5）
- 各タスクに正確なファイルパスを記載

---

## Phase 1: Foundational（ブロッキング前提条件）

**Purpose**: API変更・型追加・UIコンポーネント追加など、全ストーリーが依存するインフラ整備。

**⚠️ CRITICAL**: Phase 1 が完了するまで US1-5 の実装タスクは開始不可。

- [x] T001 [P] `session.list` のSELECTに `ringGameBlind2: ringGame.blind2` を追加する `packages/api/src/routers/session.ts`（既存の `ringGameName: ringGame.name` の直後に追加。`itemsWithPL` の map 内でそのまま spread されるため、追加のマッピング不要）

- [x] T002 [P] `SessionItem` インターフェースに `ringGameBlind2: number | null` フィールドを追加する `apps/web/src/sessions/hooks/use-sessions.ts`（`ringGameName` の直後に追加。`buildOptimisticItem` 関数内の初期値にも `ringGameBlind2: null` を追加）

- [x] T003 [P] shadcn/ui `Switch` コンポーネントを追加する `apps/web/src/shared/components/ui/switch.tsx`（`bunx --bun shadcn@latest add switch` を実行。実行後にファイルが正しく生成されたことを確認し、`bun x ultracite fix` でフォーマット修正）

**Checkpoint**: APIが `ringGameBlind2` を返却し、フロントエンド型が更新され、Switch コンポーネントが利用可能 → Phase 2 へ進む

---

## Phase 2: User Story 1-3 + 4 — Cash Game BB表示 / Tourney BI表示 / トグルUI（Priority: P1）🎯 MVP

**Goal**: BB/BIトグルをセッション一覧に追加し、オン時にCash GameのP&LをBB単位、TourneyのP&LをBI単位で表示する。EV P&Lも同様にBB単位で変換する。

**Independent Test**: BB/BIトグルをオンにし、blind2が設定されたCash Gameセッションの P&L が `+25.0 BB` 形式で表示されること、TourneyのP&Lが `+1.7 BI` 形式で表示されることを確認する。

### Tests for US1-4

> **NOTE: T004-T005 のテストを実装（T006-T009）の前に作成し、テストが FAIL することを確認してから実装へ進む**

- [x] T004 [P] [US1/US2/US3] `SessionCard` の BB/BI 表示テストを追加する `apps/web/src/sessions/components/__tests__/session-card.test.tsx`（既存の `makeCashGameSession` と `makeTournamentSession` ヘルパーに `ringGameBlind2: null` フィールドを追加。以下のテストケースを追加:
  ① bbBiMode=true で blind2=200, profitLoss=5000 のCash Game → ヘッダーに `+25.0 BB` が表示される
  ② bbBiMode=true で evProfitLoss=3000, blind2=200 のCash Game → EV表示が `+15.0 BB` になる
  ③ bbBiMode=true で tournamentBuyIn=5000, entryFee=500, profitLoss=14000 のTourney → ヘッダーに `+2.5 BI` が表示される（14000/5500=2.5）
  ④ bbBiMode=true で ringGameBlind2=null のCash Game → 通常のチップ値 `+5,000` が表示される（フォールバック）
  ⑤ bbBiMode=true で ringGameBlind2=0 のCash Game → 通常のチップ値が表示される（ゼロ除算回避）
  ⑥ bbBiMode=true で tournamentBuyIn=0, entryFee=0 のTourney → 通常のチップ値が表示される（フォールバック）
  ⑦ bbBiMode=false のとき → 全セッションが通常のチップ値で表示される）

- [x] T005 [P] [US4] セッション一覧ルートのトグル表示テストを追加する `apps/web/src/__tests__/sessions-route.test.tsx`（既存テストファイルに追加。BB/BI トグルの Switch がレンダリングされること、デフォルトでオフであることを検証。可能であればトグルオン時にSessionCardに bbBiMode=true が渡されることも検証）

### Implementation for US1-4

- [x] T006 [US1/US2/US3] `SessionCard` コンポーネントの props に `bbBiMode: boolean` を追加し、BB/BI 変換ロジックを実装する `apps/web/src/sessions/components/session-card.tsx`（以下の変更を行う:
  ① `SessionCardProps` に `bbBiMode: boolean` を追加
  ② `SessionCardProps.session` に `ringGameBlind2: number | null` を追加
  ③ ヘルパー関数 `toBB(value: number, blind2: number | null): number | null` を追加 — blind2 が null または 0 なら null を返し、それ以外は value / blind2 を返す
  ④ ヘルパー関数 `computeTotalCost(session): number` を追加 — (tournamentBuyIn ?? 0) + (entryFee ?? 0) + ((rebuyCount ?? 0) * (rebuyCost ?? 0)) + (addonCost ?? 0) を返す
  ⑤ ヘルパー関数 `toBI(profitLoss: number, totalCost: number): number | null` を追加 — totalCost が 0 なら null を返し、それ以外は profitLoss / totalCost を返す
  ⑥ ヘルパー関数 `formatBBBI(value: number, unit: "BB" | "BI"): string` を追加 — `${value >= 0 ? "+" : ""}${value.toFixed(1)} ${unit}` を返す
  ⑦ `SessionHeader` に `bbBiMode` と `session.ringGameBlind2` を渡し、bbBiMode時にP&L表示をBB/BI単位に切替（Cash Game: formatBBBI(toBB(profitLoss, blind2), "BB")、Tourney: formatBBBI(toBI(profitLoss, computeTotalCost(session)), "BI")）。変換不可の場合は従来の `formatProfitLoss` にフォールバック
  ⑧ `SessionHeader` のEV P&L表示もbbBiMode時にBB単位に変換（evProfitLoss / blind2）
  ⑨ `SessionCard` コンポーネント本体で `bbBiMode` prop を受け取り、`SessionHeader` 等に渡す）
  （T001, T002, T004 に依存）

- [x] T007 [US4] セッション一覧ルートに BB/BI トグルを追加する `apps/web/src/routes/sessions/index.tsx`（以下の変更を行う:
  ① `useState<boolean>(false)` で `bbBiMode` を管理
  ② `PageHeader` の `actions` 内、`SessionFilters` と `New Session` ボタンの間に `<div className="flex items-center gap-1.5"><Label htmlFor="bb-bi-switch" className="text-xs">BB/BI</Label><Switch id="bb-bi-switch" checked={bbBiMode} onCheckedChange={setBbBiMode} /></div>` を追加
  ③ `SessionCard` に `bbBiMode={bbBiMode}` prop を渡す
  ④ `Switch` と `Label` のインポートを追加）
  （T003, T006 に依存）

**Checkpoint**: BB/BI トグルをオンにし、Cash Game の P&L が BB 単位（`+25.0 BB`）、Tourney の P&L が BI 単位（`+2.5 BI`）で表示され、EV P&L も BB 単位で表示されることを確認。blind2 や totalCost が 0/null のセッションでは通常表示にフォールバックすることを確認。トグルオフで通常表示に戻ることを確認。

---

## Phase 3: User Story 5 — セッションカード詳細部のBB/BI単位表示（Priority: P2）

**Goal**: BB/BIモードオン時に、Cash Gameセッションカードの展開時詳細部（Buy-in, Cash-out, EV Cash-out行）もBB単位で表示する。

**Independent Test**: BB/BIモードオンでCash Gameセッションカードを展開し、Buy-in、Cash-out がBB単位で表示されていることを確認する。

### Tests for US5

- [x] T008 [P] [US5] `SessionCard` の詳細部BB表示テストを追加する `apps/web/src/sessions/components/__tests__/session-card.test.tsx`（以下のテストケースを追加:
  ① bbBiMode=true で blind2=200, buyIn=10000, cashOut=15000 のCash Game → 展開時に Buy-in `50.0 BB`, Cash-out `75.0 BB` が表示される
  ② bbBiMode=true で evCashOut=16000, blind2=200 のCash Game → 展開時に EV Cash-out `80.0 BB` が表示される
  ③ bbBiMode=true のTourney → 展開時の Buy-in, Entry Fee, Prize 等は通常のチップ値のまま（変換されない）
  ④ bbBiMode=true で blind2=null のCash Game → 展開時も通常のチップ値で表示）

### Implementation for US5

- [x] T009 [US5] `CashGameDetails` コンポーネントに bbBiMode を反映する `apps/web/src/sessions/components/session-card.tsx`（以下の変更を行う:
  ① `CashGameDetails` の props に `bbBiMode: boolean` を追加
  ② bbBiMode かつ blind2 が有効な場合、Buy-in, Cash-out, EV Cash-out の値を `toBB()` で変換し `{value.toFixed(1)} BB` 形式で表示
  ③ bbBiMode かつ blind2 が無効な場合、従来の `formatCompactNumber` でフォールバック
  ④ `EV P&L` 行もBB単位で変換（既にUS1-3で evProfitLoss のBB変換は実装済みなので、詳細部の EV P&L 行にも同様に適用）
  ⑤ `TournamentDetails` は変更なし — 詳細部の個別項目はチップ値のまま
  ⑥ `SessionCard` から `CashGameDetails` への bbBiMode prop 受け渡しを追加）
  （T006, T008 に依存）

**Checkpoint**: BB/BIモードオンでCash Gameセッションカードを展開し、Buy-in `50.0 BB`、Cash-out `75.0 BB`、EV Cash-out `80.0 BB` と表示されることを確認。Tourney展開時は通常のチップ値のまま。

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: コード品質・テスト通過の最終確認

- [x] T010 [P] `bun x ultracite fix` を実行して変更ファイルのフォーマット・lint を修正する（対象: `session.ts`（API）, `use-sessions.ts`, `session-card.tsx`, `sessions/index.tsx`, `switch.tsx`, テストファイル）
- [x] T011 `bun run test` を実行して全テストが通過することを確認する（T010 に依存）
- [x] T012 `bun run check-types` を実行して型エラーがないことを確認する（T010 に依存）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: 即座に開始可能 — Phase 2 をブロック
- **US1-4 (Phase 2)**: Phase 1（T001-T003）完了後に開始可能
  - T004-T005（テスト作成）は Phase 1 完了後すぐに着手可能
  - T006（SessionCard実装）は T001 + T002 + T004 の完了後
  - T007（トグルUI）は T003 + T006 の完了後
- **US5 (Phase 3)**: Phase 2（T006）完了後に開始可能
  - T008（テスト作成）は T006 完了後
  - T009（実装）は T008 完了後
- **Polish (Phase 4)**: Phase 3 完了後

### Within Each Phase

```
Phase 1:
  T001（API blind2 追加）─┐
  T002（SessionItem型追加）─┤─→ Phase 2 開始
  T003（Switch追加）───────┘

Phase 2:
  T004（SessionCard テスト）─┐
  T005（ルートテスト）───────┤
                            ├→ T006（SessionCard BB/BI実装）→ T007（トグルUI実装）
                            │
  ※ T006 は T001 + T002 + T004 に依存
  ※ T007 は T003 + T006 に依存

Phase 3:
  T008（詳細部テスト）→ T009（CashGameDetails BB実装）

Phase 4:
  T010（ultracite fix）→ T011（test）+ T012（check-types）[並列]
```

### Parallel Opportunities

- T001, T002, T003 はすべて別ファイルのため並列実行可能
- T004, T005 は別ファイルのため並列実行可能
- T011, T012 は並列実行可能

---

## Implementation Strategy

### MVP First（US1-4: Phase 1 + Phase 2）

1. T001-T003: インフラ整備（API + 型 + Switch コンポーネント）
2. T004-T005: テスト作成（FAIL することを確認）
3. T006: SessionCard BB/BI表示実装（テストが PASS になることを確認）
4. T007: トグルUI実装
5. **STOP and VALIDATE**: トグルオン/オフで表示が切り替わることを確認

### Incremental Delivery

1. Phase 1 + Phase 2 → MVP（P&Lのみ BB/BI 対応）→ 動作確認
2. Phase 3 → 詳細部も BB/BI 対応 → 動作確認
3. Phase 4 → 品質保証 → コミット

---

## Notes

- [P] タスク = 異なるファイル、依存なし
- [US1/US2/US3] は一括実装（Cash BB / Tourney BI / EV BB は同一コンポーネント内で同時実装が効率的）
- DBマイグレーション不要 — 既存の `ringGame.blind2` カラムを活用
- BB/BI変換ヘルパー関数は session-card.tsx 内のモジュールスコープに配置（過度な抽象化を避ける）
- Constitution V 準拠: UI テキストは英語（"BB/BI", "+25.0 BB", "+1.7 BI"）
- Constitution VI 準拠: Switch はタッチフレンドリー（デフォルトで44px以上）
- Constitution VIII 準拠: トグル状態はローカルstate、新規mutation/API呼び出しなし
