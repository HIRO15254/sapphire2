# Feature × Domain Map

> UI リライト前の現状記録（2026-05 時点 / branch `claude/refactor-data-structure-HJP8U`）。
> `apps/web/src/features/` 配下の 7 つの feature について、画面 → hook → tRPC procedure → DB テーブル の対応関係を網羅する。新 UI 設計時の参照ベースライン。

---

## 何を解決しているか

sapphire2 の web は「7 つの feature ディレクトリ」「20 個の tRPC router」「22 個の DB テーブル」が複雑に絡む。
特に `live-sessions` feature は 182 ファイルあり、`session` / `live-session` / `tournament` / `ring-game` / `session-event` の 5 つの router を横断する。

この複雑度を 1 枚にマップしておかないと、

- 「この画面はどの procedure を叩く？」が毎回コードを開いて調べることになる
- 「procedure 名と feature 名がズレる」(`ringGame` router を `stores` feature が使う、など) が積もる
- リライト時に「触っていい範囲」「触ると別画面が壊れる範囲」の境界が曖昧になる

このドキュメントは、リライト前の責務分担を「機械的に検証可能な形」で固定する。新 UI に移植する際の checklist として使う。

---

## 全体マップ

### Feature × Router 行列

`■` = その feature の hook が直接呼ぶ / `□` = 共有テーブル経由で間接的に依存 / 空白 = 無関係。

| Feature → / Router ↓ | currencies | dashboard | live-sessions | players | sessions | stores | update-notes |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `currency` | ■ | ■ | ■ | | | ■ | |
| `currencyTransaction` | ■ | | | | | | |
| `transactionType` | ■ | | | | | | |
| `store` | | | ■ | | | ■ | |
| `ringGame` | | | ■ | | | ■ | |
| `tournament` | | | ■ | | | ■ | |
| `tournamentChipPurchase` | | | ■ | | | ■ | |
| `limitFormat` | | | | | ■ | | |
| `session` | | ■ | ■ | □ | ■ | | |
| `liveSession` | | | ■ | ■ | ■ | | |
| `sessionEvent` | | | ■ | ■ | | | |
| `sessionTag` | | | | | ■ | | |
| `player` | | | ■ | ■ | | | |
| `playerTag` | | | | ■ | | | |
| `dashboardWidget` | | ■ | | | | | |
| `updateNoteView` | | | | | | | ■ |
| `aiExtract` | | | ■ | | | ■ | |
| `variant` | 未確認 | | 未確認 | | 未確認 | 未確認 | |

> **「未確認」について**: `variant` router は `packages/api/src/routers/index.ts` に登録されているが、`apps/web/src/features/**` で `trpc.variant.*` を grep してもヒットなし。サーバ側だけ用意されて web 側未統合の可能性が高い。確認対象外。

### Feature × ファイル数 × 主要画面

| Feature | ファイル数 (`.ts` + `.tsx`) | 主要 route | 役割 |
| --- | --: | --- | --- |
| `currencies` | 30 | `/currencies/` | 通貨 + 残高履歴の CRUD |
| `dashboard` | 54 | `/dashboard` | グリッド型ウィジェットボード |
| `live-sessions` | 182 | `/active-session` / `/active-session/events` / `/active-session/game` | 進行中セッションの UI 一式 |
| `players` | 40 | `/players/` | プレイヤー一覧・タグ管理 |
| `sessions` | 62 | `/sessions/` / `/sessions/$id` | セッション履歴 + 詳細編集 |
| `stores` | 66 | `/stores/` / `/stores/$storeId` | 店舗 + リングゲーム + トーナメントマスタ |
| `update-notes` | 7 | （シート） | 既読バージョン管理（route なし、shell から開く） |

### Procedure 件数サマリ

サーバ側 (`packages/api/src/routers/*`) の procedure 数:

| Router | procedure 数 | 主要 procedure |
| --- | --: | --- |
| `currency` | 4 | `list` / `create` / `update` / `delete` |
| `currencyTransaction` | 4 | `listByCurrency` / `create` / `update` / `delete` |
| `transactionType` | 4 | `list` / `create` / `update` / `delete` |
| `store` | 5 | `list` / `getById` / `create` / `update` / `delete` |
| `ringGame` | 7 | `listByStore` / `getById` / `create` / `update` / `archive` / `restore` / `delete` (+ blind set 系) |
| `tournament` | 16 | `listByStore` / `getById` / CRUD / `archive` / `restore` / `addTag` / `removeTag` / `listBlindLevels` / `addBlindLevel` / `updateBlindLevel` / `removeBlindLevel` / blind set 系 |
| `tournamentChipPurchase` | 5 | `listByTournament` / `create` / `update` / `delete` / `reorder` |
| `limitFormat` | 4 | `list` / `create` / `update` / `delete` |
| `session` | 5 | `create` / `list` / `getById` / `update` / `delete` |
| `liveSession` | 16 | `create` / `complete` / `reopen` / `discard` / `update` / `updateRule` / `getById` / blind level 系 / blind set 系 / chip purchase option 系 |
| `sessionEvent` | 7 | `list` / `create` / `update` / `delete` / `addPlayer` / `removePlayer` / `addTemporaryPlayer` |
| `sessionTag` | 4 | `list` / `create` / `update` / `delete` |
| `player` | 5 | `list` / `getById` / `create` / `update` / `delete` |
| `playerTag` | 4 | `list` / `create` / `update` / `delete` |
| `dashboardWidget` | 5 | `list` / `create` / `update` / `updateLayouts` / `delete` |
| `updateNoteView` | 3 | `list` / `markViewed` / `getLatestViewedVersion` |
| `aiExtract` | 2 | `extractTournamentData` / `extractTablePlayers` |
| `variant` | 4 | `list` / `create` / `update` / `delete` （web 未統合） |

---

## Feature 詳細

### currencies

**画面（routes）**:

- `/currencies/` — 通貨カード一覧 + 各カードの残高履歴 + 「種別を編集」ボタンで Transaction Type 管理シートを開く。
- route 配下の `__tests__/use-currencies-page.test.ts` に挙動の網羅テスト。

**主要 hook**:

- `apps/web/src/features/currencies/hooks/use-currencies.ts` — 通貨 + 残高履歴の取得 / 通貨と取引の CRUD（楽観更新あり）。
- `apps/web/src/features/currencies/hooks/use-transaction-types.ts` — 取引種別 (Transaction Type) のリスト + 作成。デフォルト種別 (`DEFAULT_TRANSACTION_TYPES`) はサーバ側で自動 seed される（`transaction-type.ts:12` の `list` で実在件数 0 のときに作成）。
- `apps/web/src/features/currencies/hooks/use-type-combobox.ts` — `trpc` を直接叩かない UI hook。
- `apps/web/src/features/currencies/components/transaction-type-manager/use-transaction-type-manager.ts` — Transaction Type の CRUD（モーダル内）。
- `apps/web/src/routes/currencies/-use-currencies-page.ts` — ページ全体の状態管理。

**呼び出す tRPC procedure**:

| Procedure | 種別 | 用途 |
| --- | --- | --- |
| `trpc.currency.list` | query | 通貨一覧 |
| `trpc.currency.create` | mutation | 通貨新規作成（楽観追加） |
| `trpc.currency.update` | mutation | 通貨更新 |
| `trpc.currency.delete` | mutation | 通貨削除 |
| `trpc.currencyTransaction.listByCurrency` | query | 残高履歴の cursor pagination |
| `trpc.currencyTransaction.create` | mutation | 取引追加 |
| `trpc.currencyTransaction.update` | mutation | 取引編集 |
| `trpc.currencyTransaction.delete` | mutation | 取引削除 |
| `trpc.transactionType.list` | query | 取引種別の一覧（空なら自動 seed） |
| `trpc.transactionType.create` | mutation | 種別追加 |
| `trpc.transactionType.update` | mutation | 種別名変更 |
| `trpc.transactionType.delete` | mutation | 種別削除 |

**触る DB テーブル**: `currency` / `currency_transaction` / `transaction_type` （すべて `packages/db/src/schema/store.ts` で定義）。

**特記事項**:

- 残高履歴は **cursor pagination** (`cursor: z.string().optional()`)、ページサイズ 20。`currency-transaction.ts:11` の `PAGE_SIZE = 20` 定数。
- 通貨削除時、関連 `currency_transaction` は FK の `onDelete` ポリシー任せ（`packages/db/src/schema/store.ts` の定義を参照）。
- 楽観更新は [`utils/optimistic-update.ts`](apps/web/src/utils/optimistic-update.ts) 経由。
- ダッシュボードの `currency_balance` ウィジェットも同じ `currency.list` を参照する。

---

### dashboard

**画面（routes）**:

- `/dashboard` — `react-grid-layout` ベースのウィジェットボード。デスクトップ / モバイルで別レイアウト。

**主要 hook**:

- `apps/web/src/features/dashboard/hooks/use-dashboard-widgets.ts` — `list` / `create` / `update` / `delete` のラッパ。`WidgetType` は `summary_stats` / `recent_sessions` / `active_session` / `currency_balance` の 4 種。
- `apps/web/src/features/dashboard/hooks/use-layout-sync.ts` — レイアウト変更を `pendingRef` (Map) にバッファし、`flush()` で `dashboardWidget.updateLayouts` をまとめて呼ぶ。`useBlocker` でページ離脱時に保存ダイアログを出す。
- `apps/web/src/features/dashboard/hooks/use-current-device.ts` — メディアクエリで `"desktop" | "mobile"` を返す（tRPC は呼ばない）。
- `apps/web/src/features/dashboard/widgets/<widget>/use-<widget>.ts` — 各ウィジェットが独自に必要な query を呼ぶ。
- `apps/web/src/routes/-use-dashboard-page.ts` — 編集モード / blocker / コンテナ幅計測 を統合。

**呼び出す tRPC procedure**:

| Procedure | 種別 | 用途 |
| --- | --- | --- |
| `trpc.dashboardWidget.list` | query | デバイス別 widget リスト |
| `trpc.dashboardWidget.create` | mutation | ウィジェット追加 |
| `trpc.dashboardWidget.update` | mutation | ウィジェット config 更新 |
| `trpc.dashboardWidget.updateLayouts` | mutation | レイアウト一括更新（ドラッグ完了後） |
| `trpc.dashboardWidget.delete` | mutation | ウィジェット削除 |
| `trpc.session.list` | query | `summary_stats` / `recent_sessions` / `active_session` ウィジェットが参照 |
| `trpc.currency.list` | query | `currency_balance` ウィジェットが参照 |

**触る DB テーブル**: `dashboard_widget`（自分の書き込み対象）+ `game_session` / `currency` （読み取り）。

**特記事項**:

- **永続化戦略**: レイアウト変更は即時 query cache に反映 (`queryClient.setQueryData`)、サーバには `flush()` で 1 リクエストにまとめて送る。`useBlocker` で未保存離脱を防止。
- **device 別保存**: `dashboard_widget` テーブルは `device` カラムで desktop / mobile を分離。同じユーザでも別レイアウト。
- **WidgetType の追加点**: 新 widget を追加する場合、(1) `WidgetType` union 型, (2) `widgets/<name>/` ディレクトリ, (3) `widgets/registry/registry.ts` の登録 の 3 箇所を更新する必要がある。
- **`active_session` widget は `session.list` の filtered 結果を使う**。専用 procedure はない（後述「落とし穴」）。

---

### live-sessions

**画面（routes）**:

- `/active-session/` — トーナメント timer / コンパクトサマリ / ポーカーテーブル UI のいずれかを表示するエントリ。
- `/active-session/game` — ポーカーテーブルレイアウトでの座席 / スタック編集。
- `/active-session/events` — タイムラインのイベント一覧編集。
- `/live-sessions/$sessionType/$sessionId/events` — **redirect-only**。`/sessions/$id` にリダイレクトする旧 URL の互換シム（`routes/live-sessions/$sessionType/$sessionId/events.tsx`）。

**主要 hook**（`apps/web/src/features/live-sessions/hooks/`）:

| Hook | 役割 |
| --- | --- |
| `use-active-session.ts` | "アクティブな" セッション 1 件を `session.list` から検出 |
| `use-live-session.ts` | `liveSession.getById` の取得 + `update` / `discard` / `updateRule` |
| `use-live-session-create.ts` | リング / トーナメント新規セッション作成 |
| `use-create-session.ts` | フォーム駆動の薄いラッパ |
| `use-session-events.ts` | `sessionEvent.list` / `update` / `delete`（楽観） |
| `use-stack-record.ts` | スタック編集→`sessionEvent.create` + `liveSession.complete` を組み合わせる |
| `use-current-players.ts` | アクティブセッションの参加プレイヤーを `liveSession.getById` から派生 |
| `use-tournament-detail.ts` | `tournament.getById` + `tournamentChipPurchase.listByTournament` + `currency.list` 統合 |
| `use-tournament-timer-scene.ts` | timer の 1 秒刻みカウントアップ（tRPC 不使用） |
| `use-tournament-scene-actions.ts` | timer 周辺の各種 mutation |
| `use-ring-game-scene-actions.ts` | リングゲーム scene 用 mutation |
| `use-cash-game-compact-summary.ts` / `use-tournament-compact-summary.ts` | 表示用 viewmodel |
| `use-assign-dialog-state.ts` | ring / tournament 割り当て dialog の開閉 |
| `use-seat-combobox.ts` / `use-stack-sheet.tsx` | UI 制御 |
| `use-session-form.tsx` | セッション編集フォームの統合 hook |

**コンポーネント側の hook**（一部）:

- `components/assign-tournament-dialog/use-assign-tournament.ts` — 既存トーナメント割り当て or 新規作成 + `liveSession.updateRule`。
- `components/assign-ring-game-dialog/use-assign-ring-game.ts` — 同上 (ring-game)。
- `components/seat-from-screenshot-sheet/use-seat-from-screenshot.ts` — `aiExtract.extractTablePlayers` 経由でスクショから座席自動入力。
- `components/add-player-sheet/use-add-player-search.ts` — `player.list` 検索。
- `utils/seat-screenshot.ts` — スクショ抽出結果を `sessionEvent.addPlayer` / `addTemporaryPlayer` に流す純粋関数。

**呼び出す tRPC procedure**:

| Procedure | 種別 | 用途 |
| --- | --- | --- |
| `trpc.liveSession.create` | mutation | リング / トーナメント新規作成 |
| `trpc.liveSession.getById` | query | アクティブセッションの詳細（最も頻繁に invalidate される） |
| `trpc.liveSession.update` | mutation | セッション全体更新 |
| `trpc.liveSession.updateRule` | mutation | ルール（リング/トーナメント参照, blind, chip option）の差分更新 |
| `trpc.liveSession.complete` | mutation | セッション終了 → `session` に確定 |
| `trpc.liveSession.discard` | mutation | アクティブセッション破棄 |
| `trpc.liveSession.addBlindSet` / `updateBlindSet` / `removeBlindSet` | mutation | blind set 編集 |
| `trpc.liveSession.addBlindLevel` / `updateBlindLevel` / `removeBlindLevel` | mutation | blind level 編集 |
| `trpc.liveSession.addChipPurchaseOption` / `updateChipPurchaseOption` / `removeChipPurchaseOption` | mutation | チップ購入オプション |
| `trpc.session.list` | query | アクティブセッション検出 / リスト無効化のキー共有用 |
| `trpc.sessionEvent.list` | query | タイムライン |
| `trpc.sessionEvent.create` | mutation | スタック更新 / Add-on / All-in 等のイベント追加 |
| `trpc.sessionEvent.update` | mutation | イベント編集 |
| `trpc.sessionEvent.delete` | mutation | イベント削除 |
| `trpc.sessionEvent.addPlayer` | mutation | 参加プレイヤー追加 |
| `trpc.sessionEvent.addTemporaryPlayer` | mutation | 名前のみの仮プレイヤー追加 |
| `trpc.sessionEvent.removePlayer` | mutation | 参加プレイヤー離脱 |
| `trpc.tournament.getById` | query | トーナメント詳細 |
| `trpc.tournament.listByStore` | query | dialog の選択肢 |
| `trpc.tournament.create` | mutation | dialog からの新規 tournament |
| `trpc.tournament.addBlindLevel` / `addTag` | mutation | dialog 内の付随作成 |
| `trpc.tournamentChipPurchase.listByTournament` | query | 詳細表示 |
| `trpc.tournamentChipPurchase.create` | mutation | dialog 内 |
| `trpc.ringGame.listByStore` | query | dialog の選択肢 |
| `trpc.ringGame.create` | mutation | dialog からの新規 ring game |
| `trpc.store.list` | query | dialog の店舗選択 |
| `trpc.player.list` | query | seat sheet の検索 |
| `trpc.currency.list` | query | 通貨表示 |
| `trpc.aiExtract.extractTablePlayers` | mutation | スクショ→座席抽出 |

**触る DB テーブル**:

- 自身が書く: `game_session`, `session_blind_level`, `session_cash_blind_set`, `session_cash_detail`, `session_tournament_blind_set`, `session_tournament_detail`, `session_chip_purchase_option`, `session_event`.
- 連動して書く（assign dialog 経由）: `tournament`, `tournament_blind_level`, `tournament_blind_set`, `tournament_tag`, `tournament_chip_purchase`, `ring_game`, `ring_game_blind_set`.
- 読むだけ: `store`, `player`, `currency`, `limit_format`, `session_tag`, `session_to_session_tag`.

**特記事項**:

- **このプロジェクトで最大の feature（182 ファイル）**。理由は「進行中セッションのすべての UI 状態」をここに閉じ込めているため。
- **2 種類の "session" を扱う**:
  - `liveSession.*` — `is_active = true` （または同等の状態フラグ）なセッションへの **編集向け** procedure。
  - `session.list` — 履歴含む全セッションのリスト。アクティブ検出のためにこちらも参照する。
- **楽観更新の中核**: [`utils/optimistic-session-event.ts`](apps/web/src/features/live-sessions/utils/optimistic-session-event.ts) が `sessionEvent.list` / `liveSession.getById` / `session.list` の 3 つを同時に snapshot / 復元する。`snapshotQueries` を使うほぼ唯一の場所。
- **`use-stack-record.ts` 内で `sessionEvent.create` を 7 種類のイベントタイプに対して呼んでいる**（addOn / allIn / chipsAddRemove / memo / purchaseChips / timeOnly / updateStack）。新しいイベント種別を追加する場合の修正起点。
- **dialog が tournament / ring-game / chip-purchase の作成権限を持つ**: `assign-tournament-dialog` 内から `tournament.create` + `tournament.addTag` + `tournament.addBlindLevel` + `tournamentChipPurchase.create` を順に発火する複雑な flow がある。

---

### players

**画面（routes）**:

- `/players/` — プレイヤー一覧 + 検索 + タグフィルタ + プレイヤー作成・編集。

**主要 hook**:

- `apps/web/src/features/players/hooks/use-players.ts` — `player.list` + filter + `playerTag.list` + プレイヤー CRUD（タグ作成も内包: 既存タグになければ `playerTag.create` を先に呼ぶ）。
- `apps/web/src/features/players/hooks/use-player-detail.ts` — `player.getById` + `playerTag.list` + 単一プレイヤー更新 + タグ作成。
- `apps/web/src/features/players/hooks/use-player-tags.ts` — タグ CRUD。
- `apps/web/src/features/players/hooks/use-poker-table-interaction.ts` — **`/active-session/game` のポーカーテーブル操作を担当**（座席クリックで `sessionEvent.addPlayer` / `removePlayer`）。実体は live-sessions 用。
- `apps/web/src/features/players/hooks/use-table-players.ts` — 同様にアクティブセッションのプレイヤー操作（`sessionEvent.addPlayer` / `addTemporaryPlayer` / `removePlayer`）。
- `apps/web/src/routes/players/-use-players-page.ts` — ページ全体の filter state。

**呼び出す tRPC procedure**:

| Procedure | 種別 | 用途 |
| --- | --- | --- |
| `trpc.player.list` | query | プレイヤー一覧 + 検索 |
| `trpc.player.getById` | query | 詳細 |
| `trpc.player.create` | mutation | 新規作成（楽観） |
| `trpc.player.update` | mutation | 更新 |
| `trpc.player.delete` | mutation | 削除 |
| `trpc.playerTag.list` | query | タグ一覧 |
| `trpc.playerTag.create` | mutation | タグ作成（プレイヤー編集中にインライン作成） |
| `trpc.playerTag.update` | mutation | タグ編集 |
| `trpc.playerTag.delete` | mutation | タグ削除 |
| `trpc.sessionEvent.addPlayer` | mutation | （poker table から） |
| `trpc.sessionEvent.addTemporaryPlayer` | mutation | （poker table から） |
| `trpc.sessionEvent.removePlayer` | mutation | （poker table から） |
| `trpc.liveSession.getById` | query | poker table 用 |

**触る DB テーブル**: `player`, `player_tag`, `player_to_player_tag` （`packages/db/src/schema/player.ts`）。間接的に `session_event`（poker table 経由）。

**特記事項**:

- **`hooks/use-poker-table-interaction.ts` と `use-table-players.ts` の存在は意外**。「プレイヤー操作」という意味で players feature に置かれているが、書き込む対象は live-sessions 文脈。リライト時にどちらの feature に置くか要検討。
- タグ作成のインライン flow: プレイヤー編集中に存在しないタグを入力 → `playerTag.create` → 返ってきた id を `player.update` に渡す、という 2 段ステップ。
- 楽観更新は player CRUD すべてに適用。

---

### sessions

**画面（routes）**:

- `/sessions/` — セッション履歴一覧 + filter + 検索 + 集計サマリ + タグ管理シート。
- `/sessions/$id` — セッション詳細編集（blind set / chip purchase option / game rule など `liveSession.*` の編集 procedure を流用）。

**主要 hook**:

- `apps/web/src/features/sessions/hooks/use-sessions.ts` — `session.list` + filter + `sessionTag.list` + `session.create` / `update` / `delete` + `liveSession.reopen`（履歴セッションを再開）。
- `apps/web/src/routes/sessions/-use-sessions-page.ts` / `-use-session-detail-page.ts` — ページ統合。
- `components/session-tag-manager/use-session-tags.ts` — タグ CRUD。
- `components/game-rule-section/use-game-rule-section.ts` — `liveSession.updateRule` を呼ぶ（履歴セッションでも `liveSession` router を再利用）。
- `components/blind-set-editor/use-blind-set-editor.ts` — `liveSession.addBlindSet` / `updateBlindSet` / `removeBlindSet` / `addBlindLevel` / `updateBlindLevel` / `removeBlindLevel` + `limitFormat.list`。
- `components/chip-purchase-option-editor/use-chip-purchase-option-editor.ts` — `liveSession.addChipPurchaseOption` / `updateChipPurchaseOption` / `removeChipPurchaseOption`。
- `components/current-players-list/use-current-players-list.ts` — `liveSession.getById` 経由のプレイヤーリスト表示。

**呼び出す tRPC procedure**:

| Procedure | 種別 | 用途 |
| --- | --- | --- |
| `trpc.session.list` | query | 履歴一覧 + filter |
| `trpc.session.create` | mutation | 履歴セッションの手動追加 |
| `trpc.session.update` | mutation | 履歴セッション編集 |
| `trpc.session.delete` | mutation | 削除 |
| `trpc.sessionTag.list` | query | タグ |
| `trpc.sessionTag.create` / `update` / `delete` | mutation | タグ CRUD |
| `trpc.liveSession.reopen` | mutation | 履歴 → アクティブに戻す |
| `trpc.liveSession.updateRule` | mutation | （詳細ページから）ルール更新 |
| `trpc.liveSession.addBlindSet` 他 blind set 系 | mutation | 詳細での blind 編集 |
| `trpc.liveSession.addBlindLevel` 他 blind level 系 | mutation | 同上 |
| `trpc.liveSession.addChipPurchaseOption` 他 | mutation | 同上 |
| `trpc.liveSession.getById` | query | 詳細ページのソース |
| `trpc.limitFormat.list` | query | blind set editor の format 選択肢 |

**触る DB テーブル**: 自身が書くのは `game_session`, `session_tag`, `session_to_session_tag`。詳細編集経由で `session_blind_level`, `session_cash_blind_set`, `session_tournament_blind_set`, `session_cash_detail`, `session_tournament_detail`, `session_chip_purchase_option`。読むだけ: `limit_format`。

**特記事項**:

- **「session feature が `liveSession` router を直接呼ぶ」**のがこの feature の最大の特徴。`sessions/$id` 詳細編集は live-sessions と同じ procedure を共有する。リライト時に「履歴 vs アクティブ」の責務分離を再設計するなら、まず `liveSession.update*` 系を 2 つに分けるかどうかを決める。
- セッションタグは `sessionTag` + `session_to_session_tag` のジャンクションテーブル。

---

### stores

**画面（routes）**:

- `/stores/` — 店舗一覧 + 作成・編集。
- `/stores/$storeId` — 店舗内のリングゲーム / トーナメントマスタの管理（タブ切替）。

**主要 hook**:

- `apps/web/src/features/stores/hooks/use-stores.ts` — `store.list` + CRUD。
- `apps/web/src/features/stores/hooks/use-ring-games.ts` — `ringGame.listByStore` (active / archived) + `currency.list` + CRUD + `archive` / `restore`。
- `apps/web/src/features/stores/hooks/use-tournaments.ts` — `tournament.listByStore` + `tournament.create` / `update` / `archive` / `restore` / `delete` + `addTag` / `removeTag` + `addBlindLevel` + `tournamentChipPurchase.create` / `delete` + `listBlindLevels` の prefetch。
- `apps/web/src/features/stores/hooks/use-blind-levels.ts` — トーナメント詳細での blind level 編集。
- `apps/web/src/features/stores/hooks/use-store-games.ts` — 横断的に「店舗 + その RG + その TR」を 1 hook にまとめる（`store.list` + `ringGame.listByStore` + `tournament.listByStore` + `currency.list`）。
- `apps/web/src/features/stores/hooks/use-ring-game-row.ts` / `use-tournament-row.ts` / `use-sortable-level-row.ts` / `use-empty-row.ts` — 行単位の編集 UI。
- `components/tournament-tab/use-tournament-tab.ts` — タブ内の総合 hook。新規トーナメント作成時に `tournament.create` → `addTag` (複数) → `addBlindLevel` (複数) → `tournamentChipPurchase.create` (複数) を順次実行する。
- `components/ai-extract-input/use-ai-extract-input.ts` — `aiExtract.extractTournamentData`（URL / 画像 / テキストからトーナメント情報抽出）。
- `routes/stores/-use-stores-page.ts` / `-use-store-detail-page.ts`。

**呼び出す tRPC procedure**:

| Procedure | 種別 | 用途 |
| --- | --- | --- |
| `trpc.store.list` | query | 店舗一覧 |
| `trpc.store.create` / `update` / `delete` | mutation | 店舗 CRUD |
| `trpc.ringGame.listByStore` | query | リングゲーム一覧（active / archived フラグ別） |
| `trpc.ringGame.create` / `update` | mutation | リングゲーム CRUD |
| `trpc.ringGame.archive` / `restore` / `delete` | mutation | アーカイブ管理 |
| `trpc.tournament.listByStore` | query | トーナメント一覧 |
| `trpc.tournament.create` / `update` | mutation | CRUD |
| `trpc.tournament.archive` / `restore` / `delete` | mutation | 同上 |
| `trpc.tournament.addTag` / `removeTag` | mutation | タグ操作（`tournament_tag` テーブル） |
| `trpc.tournament.listBlindLevels` | query | blind level 一覧 |
| `trpc.tournament.addBlindLevel` / `updateBlindLevel` / `removeBlindLevel` | mutation | blind level 編集 |
| `trpc.tournamentChipPurchase.create` / `delete` | mutation | チップ購入オプション |
| `trpc.currency.list` | query | 通貨選択肢 |
| `trpc.aiExtract.extractTournamentData` | mutation | URL/画像/テキスト解析 |

**触る DB テーブル**: `store`, `ring_game`, `ring_game_blind_set`, `tournament`, `tournament_blind_level`, `tournament_blind_set`, `tournament_tag`, `tournament_chip_purchase`. 読むだけ: `currency`.

**特記事項**:

- **`stores` feature が `ringGame` / `tournament` router を所有**する。procedure 名と feature 名が一致しないが、ドメイン的には「店舗の中のゲームマスタ」なのでこの構造になっている。
- **AI 抽出 (`aiExtract.extractTournamentData`)** は Claude API を Cloudflare Worker から直接叩く。`packages/api/src/routers/ai-extract.ts` 参照。
- アーカイブは soft delete（`is_archived = true`）。`archive` / `restore` / `delete` の 3 mutation を分けている。

---

### update-notes

**画面（routes）**:

- 専用 route なし。`components/update-notes-sheet/` がアプリシェルから開かれる Drawer。

**主要 hook**:

- `apps/web/src/features/update-notes/hooks/use-update-notes-viewed.ts` — `updateNoteView.list` + `markViewed`（最後に既読バージョンを記録）+ `getLatestViewedVersion` を invalidate。
- `apps/web/src/features/update-notes/components/update-notes-sheet/use-update-notes-sheet.tsx` — シート表示制御 + 未読バッジ判定。
- `apps/web/src/features/update-notes/constants.ts` — クライアント側に埋め込んだリリースノートの配列（バージョン文字列ベース）。

**呼び出す tRPC procedure**:

| Procedure | 種別 | 用途 |
| --- | --- | --- |
| `trpc.updateNoteView.list` | query | 既読履歴 |
| `trpc.updateNoteView.markViewed` | mutation | 既読登録 |
| `trpc.updateNoteView.getLatestViewedVersion` | query | 最後に既読したバージョン |

**触る DB テーブル**: `update_note_view` のみ。

**特記事項**:

- **リリースノートの内容自体は DB に持たず `constants.ts` に直書き**。DB には「ユーザがどのバージョンまで既読か」だけを保存する。
- 新バージョンリリース時はクライアントの `constants.ts` を更新するだけで、サーバ側変更は不要。
- 最小の feature（7 ファイル）。

---

## 決定と理由

### なぜ live-sessions が 182 ファイルと突出しているのか

「進行中ポーカーセッションの操作 UI」をすべてここに集約しているため。具体的には:

1. **イベント編集 UI が多形態**: タイムライン (`session-events-scene`)、ポーカーテーブル (`active-session-game-scene`)、トーナメントタイマー (`active-session-scene`) の 3 系統を切替表示する。
2. **イベント種別ごとの editor + bottom sheet + form がペアで存在**: `addon` / `all-in` / `chip-purchase` / `chips-add-remove` / `memo` / `purchase-chips` / `session-end` / `session-start` / `time-only` / `update-stack` の 10 種類。それぞれ `event-editors/<kind>/`, `event-fields/<kind>/`, ペアで `*-bottom-sheet/`, `*-form/` がある。
3. **dialog が CRUD の主役を兼ねる**: `assign-tournament-dialog` / `assign-ring-game-dialog` は単にセレクトするだけでなく、その場で tournament / ring-game を新規作成できる（→ stores feature の procedure をここから呼ぶ）。

リライト時は (2) の 10 種類のイベントを「イベント種別ごとのプラグイン構造」に整理できる余地がある（registry パターン）。

### session と live-session の責務分離の理由

- `session.*` router は **履歴 + アクティブを含む全セッション** の list / get / 軽い update / delete を担当する。
- `liveSession.*` router は **アクティブセッションの "編集に特化した" mutation 群**（`updateRule`, `addBlindLevel`, blind set 系, chip purchase option 系, `complete`, `discard`, `reopen`）を提供する。
- アクティブ判定は `session.list` の結果から派生（`is_active` / status カラム）。

ただし、現状 `sessions/$id` 詳細編集（履歴）も `liveSession.updateRule` 等を呼んでおり、**「liveSession の名前は誤解を生む」**。実態は「セッションの構造編集」。リライト時は `sessionRule` 等への renamed を検討するか、`liveSession` を完全に「アクティブ専用」にして履歴は別 router にするかを決める必要がある。

### dashboard widget の persist 戦略

レイアウト変更（react-grid-layout の onLayoutChange）は **immediate optimistic + deferred flush** 方式:

1. `useLayoutSync` 内の `pendingRef: Map<id, LayoutItem>` にバッファ。
2. 同時に `queryClient.setQueryData` で list cache を即時書き換え（UI 即反映）。
3. `flush()` 呼び出し時に `dashboardWidget.updateLayouts` で一括送信。
4. `useBlocker` でページ離脱前に自動 `flush` するか破棄するかを問う。

理由: ドラッグ中に大量に発火する onLayoutChange を全部サーバに送ると無駄が多い。かつ「編集モード OFF」のタイミングを保存タイミングにすることで UX が予測しやすくなる。

### widget の config を `Record<string, unknown>` で持っている理由

`dashboard_widget.config` カラムは JSON で、widget type ごとに別のスキーマを持つ（recent_sessions は `limit` を、currency_balance は `currencyId` を、など）。型は registry の `EditForm` 側で local に narrow する。リライト時には discriminated union 化する余地あり。

---

## 落とし穴

### Procedure 名と feature 名のズレ

| Router | 主な所有 feature | コメント |
| --- | --- | --- |
| `ringGame` | `stores` | リング ゲーム = 店舗内マスタなので feature 名一致せず |
| `tournament` | `stores` | 同上 |
| `tournamentChipPurchase` | `stores` （+ `live-sessions`） | dialog 経由で live-sessions からも書く |
| `liveSession` | `live-sessions` + `sessions` | 履歴セッション編集もここを使う |
| `sessionEvent` | `live-sessions` + `players` | プレイヤー追加/離脱は players feature の hook から呼ばれる |
| `currencyTransaction` | `currencies` | 名前一致だが live-sessions の経済イベントとは別ライン |
| `dashboardWidget` | `dashboard` | 一致。ただし widget の中身は他 router を参照 |

→ **「procedure 名を見ても feature が一意に決まらない」**。リライト時はメンタルモデルを「画面 → 複数 router」と捉える必要がある。

### 1 feature が複数 router を跨ぐ典型パターン

- `live-sessions` → `liveSession` + `session` + `sessionEvent` + `tournament` + `tournamentChipPurchase` + `ringGame` + `store` + `player` + `currency` + `aiExtract` の **10 router**。
- `stores` → `store` + `ringGame` + `tournament` + `tournamentChipPurchase` + `currency` + `aiExtract` の **6 router**。
- `currencies` → `currency` + `currencyTransaction` + `transactionType` の **3 router**。

dashboard widget は `session.list` / `currency.list` を **read 専用** で参照するため、各 widget の hook が独立に invalidate される（widget 側からの書き込みは `dashboardWidget.*` のみ）。

### 共有テーブル / 共有 query への複数 feature からの書き込み

| テーブル / Query | 書き込む側 |
| --- | --- |
| `game_session` | `live-sessions` (`liveSession.create` / `complete`), `sessions` (`session.create` / `update` / `delete`) |
| `session_event` | `live-sessions` (`sessionEvent.*`), `players` (`sessionEvent.addPlayer` / `removePlayer`) |
| `tournament` + 関連 | `stores` (`tournament.*`), `live-sessions` (`assign-tournament-dialog` 経由の `tournament.create`) |
| `ring_game` + 関連 | `stores` (`ringGame.*`), `live-sessions` (`assign-ring-game-dialog` 経由の `ringGame.create`) |
| `tournament_chip_purchase` | `stores`, `live-sessions` |
| `trpc.session.list` cache | `sessions`, `live-sessions`, `dashboard` 全 widget |
| `trpc.currency.list` cache | `currencies`, `dashboard` (`currency_balance`), `live-sessions`, `stores` |
| `trpc.player.list` cache | `players`, `live-sessions` (add-player-sheet, seat-from-screenshot) |
| `trpc.playerTag.list` cache | `players` (CRUD), `players` (use-players の create 内でも書く) |

→ optimistic update 時に **複数の query key を同時に snapshot / invalidate しないと UI が割れる**。これが [`live-sessions/utils/optimistic-session-event.ts`](apps/web/src/features/live-sessions/utils/optimistic-session-event.ts) が `sessionKey` / `eventsKey` / `sessionListKey` の 3 つを操作している理由。

### `active_session` widget は専用 procedure を持たない

`apps/web/src/features/dashboard/widgets/active-session-widget/use-active-session-widget.ts` は `trpc.session.list` を呼んでクライアント側で active 判定をする。専用 endpoint がないため、リスト全件を取得するコストを払っている。リライト時は `trpc.session.getActive` のような専用 procedure を検討してよい。

### `routes/live-sessions/$sessionType/$sessionId/events.tsx` は redirect 専用

旧 URL 互換シム。新規開発で `/live-sessions/...` を URL として叩くべきではない（即時 `/sessions/$id` に飛ばされる）。リライト時に削除可能か要判断（外部リンクされている可能性）。

### `variant` router の web 統合状態

`packages/api/src/routers/variant.ts` は CRUD 4 procedure を持つが、`apps/web/src/features/**` から `trpc.variant.*` の呼び出しは grep で見つからない（確認対象外として残す）。サーバ側のみ用意済み / 旧 UI 残骸 / 新 UI 想定の 3 通りいずれかは未確認。

### `aiExtract` router は 2 feature から呼ばれる

- `stores` feature の `ai-extract-input` コンポーネント → `extractTournamentData` (URL/画像/テキスト → トーナメント情報)。
- `live-sessions` feature の `seat-from-screenshot-sheet` → `extractTablePlayers` (スクショ → 座席 + プレイヤー名)。

両者は **異なる procedure を呼ぶ** ため衝突はしない。ただし「AI 抽出機能」を 1 feature にまとめるかは設計上の選択肢。

---

## 関連

- [`CLAUDE.md`](../../../CLAUDE.md) — リポジトリ全体の規約。
- [`.claude/rules/web-data-fetching.md`](../../../.claude/rules/web-data-fetching.md) — 楽観更新ヘルパ (`utils/optimistic-update.ts`) の使い方。
- [`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md) — components / hooks の責務分離（このマップで hook 一覧を中心に書いている理由）。
- `apps/web/src/utils/optimistic-update.ts` — `snapshotQuery` / `snapshotQueries` / `cancelTargets` / `invalidateTargets` / `restoreSnapshots`。複数 query を跨ぐ optimistic update の標準形。
- `apps/web/src/features/live-sessions/utils/optimistic-session-event.ts` — 共有テーブル横断 invalidate のリファレンス実装。
- `packages/api/src/routers/index.ts` — 全 router の登録ポイント。
- `packages/db/src/schema/` — 22 テーブルの定義一式（テーブル名はファイル名と一致）。
