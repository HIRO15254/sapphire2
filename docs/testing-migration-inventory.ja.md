# 既存テスト移行の棚卸し

2026-09-05 / 基準HEAD: `37371fd84f2a6c5fd32e726d2793c3489f455ca3` / **全407ファイルの初期分類。移行完了表ではない。**

[承認済み計画](testing-refactor-plan.ja.md)に沿って、既存の保護を失わずにテストを再編するための一覧。基準HEADの追跡済み `*.test.ts(x)` / `*.spec.ts(x)` を `git ls-tree -r --name-only HEAD` で列挙し、各ファイルを `git show HEAD:<path>` で取得した。作業中の追加・削除を基準値へ混ぜない。

ファイル数は407、行数は102,032。パラメーター展開後の実行ケース数ではない。プロジェクトは現行include/excludeとパスから静的に対応させたもので、runnerによる検出結果・実行時間・カバレッジの実測ではない。

## 初期分類の意味

| 分類 | 初期判断 | 移行時に必要なこと |
|---|---|---|
| keep | 保護を暫定維持する | 期待値の根拠と不足を確認する。ファイル全体の無条件承認ではない |
| review | 個別評価が必要 | 仕様、実体境界、他層の重複を読んで処置を確定する |
| replace | 一部の検証手法を置き換える候補 | 対応する実行検証を追加してから旧assertを整理する。ファイル全体の削除指示ではない |
| consolidate | 重複・構造固定を集約する候補 | 同じ契約を守る先を特定する。契約のない装飾なら不要である根拠を残す |

削除確定の分類は設けていない。`keep` 以外は削除予定という意味ではなく、`keep` も全ケース精査済みではない。静的シグナルだけで自動削除しない。全407ファイルの確定処置・代替先と実行確認は [実施記録](testing-refactor-results.ja.md) から参照できる各レビュー表に記録した。この表は開始時点の判断として保存する。

| 初期分類 | ファイル数 |
|---|---:|
| consolidate | 42 |
| keep | 52 |
| replace | 49 |
| review | 264 |

| プロジェクト | ファイル数 |
|---|---:|
| api | 45 |
| db | 32 |
| env | 2 |
| mcp | 6 |
| server | 5 |
| web-dom | 277 |
| web-node | 40 |

## 根拠の強さとシグナル

全ファイルの内容からdescribe名と下記の参照を静的抽出した。表の「対象名」は既存テストの自己記述であり、その動作を実際に保証するとの認定ではない。`A` は承認済み計画または今回の個別読解でassertとmock境界を確認したもの。それ以外の分類は機械的な候補抽出で、実装との対照・検出力検証は未了。シグナルがないことも品質の証明にはならない。

| 記号 | 確認したもの | 判断上の限界 |
|---|---|---|
| A | 計画の監査例または今回個別に内容を読んだ | ファイル全体の実行・全シナリオ検証完了ではない |
| SQL | bun:sqlite参照 | Bun専用の実行が必要。D1固有動作の証明ではない |
| AUTH-META | expectProtected呼出し | 基準HEADではmiddleware数による検証。未認証拒否の保証ではない |
| DB-META | getTableConfig / getTableColumns参照 | 宣言の反復と重要な制約を個別に区別する必要がある |
| DB-MOCK | 既存DB mockまたはbatch記録helperの参照 | SQLの絞り込み・JOIN・原子性は実DBで補う。全mockの検出ではない |
| HOOK-MOCK | use-* moduleをvi.mockしている | component配線の集約候補。すべてのassertが無価値という意味ではない |
| DOM | toHaveClass / querySelectorAll参照 | 装飾固定の候補。アクセシビリティ契約等との区別が必要 |
| HOOK | renderHook参照 | hookという層の情報のみ |
| QUERY | QueryClientまたは共通作成helper参照 | 実キャッシュの候補。全操作が実体かは別途確認 |
| REG | SA2番号またはregressionの記載 | 既知障害の再現を確認して保全。記載がない回帰テストも存在し得る |
| SKIP | .skipまたはskipIfNotBun記載 | 理由と専用runner実行を確認。意図しないskipと決めつけない |
| PATH | パスによる領域／層の分類のみ | 保護する契約や品質の判定ではない |

## 機能からの確認事項

既存ファイルを整理するだけでは、テストがない境界を見落とす。以下は移行中に実装・公開API・主要操作から逆引きして完了を確認する項目。基準HEADの代表監査から得た優先事項であり、全未テスト領域の列挙完了ではない。

| 領域 | 既存保護の起点 | 追加・置換で確認する契約 |
|---|---|---|
| 認証・所有権 | api router、server OAuth、MCP session | 有効な入力の未認証拒否、本人成功、他人ID/FK/bulk/cursor、実DB無変更、HTTP CookieとOAuth token |
| 通貨・金額 | currencies hook、live-session-pl、stats | 同時pendingと逆順応答、再取得前rollback、損益と台帳の整合、他ユーザーの集計隔離 |
| sessions / live-sessions | session router、楽観更新、tournament-lifecycle | 開始→記録→完了→reload→再開、実D1途中失敗時の親子・台帳の原子性 |
| players / rooms / games | 各page・form・hook | 実フォームと通信による検索・保存・失敗時入力保持。propsの写しと重複validationを集約 |
| logout / PWA / 更新 | use-sign-out、query-persistence、use-pwa-update | 同一browser contextでA logout→reload→B、実IndexedDB、build後Service Worker更新・復帰 |
| 日時・migration | UTC helper、migration、seed復元 | UTC日付／日跨ぎ回帰と既存データ変換を維持し、D1固有の制約差分を補う |
| UI基盤 | FormSheet、Tabs、各field | キーボード・label・Drawer・送信ガードを実操作で確認。装飾構造の固定と分離する |
| 外部API / build | AI抽出、GitHub Releases plugin | 成功・拒否・不正形式・遅延を固定fixtureで再現し、外部可用性と切り離す |

## ファイル単位の初期分類

各行は基準HEADの一意なファイルに対応する。根拠と処置はassert単位で適用し、複数の契約があるファイルを一括削除しない。

### api（45ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [packages/api/src/__tests__/ai-extract-sources.test.ts](../packages/api/src/__tests__/ai-extract-sources.test.ts) | api | review | PATH | ai-extract-sources constants：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/ai-extract-truncation.test.ts](../packages/api/src/__tests__/ai-extract-truncation.test.ts) | api | review | PATH | extractTablePlayers truncation reporting：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/ai-extract.test.ts](../packages/api/src/__tests__/ai-extract.test.ts) | api | replace | AUTH-META | aiExtract router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/auth-signup-hook.test.ts](../packages/api/src/__tests__/auth-signup-hook.test.ts) | api | review | PATH | runUserCreatedHook (signup must survive a failing onUserCreated, c13)：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/blind-level.test.ts](../packages/api/src/__tests__/blind-level.test.ts) | api | replace | AUTH-META, REG | blindLevel router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/currency-transaction.test.ts](../packages/api/src/__tests__/currency-transaction.test.ts) | api | replace | AUTH-META, DB-MOCK, REG | currencyTransaction router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/currency.test.ts](../packages/api/src/__tests__/currency.test.ts) | api | replace | A, AUTH-META | currency router：procedure存在・型・認証metadataを実callerへ集約しZod契約を保全 |
| [packages/api/src/__tests__/db-batch-atomicity.test.ts](../packages/api/src/__tests__/db-batch-atomicity.test.ts) | api | replace | A, DB-MOCK, REG | persistSessionChipPurchases atomicity (SA2-116)：SA2-116のbatch呼出し記録を実DB途中失敗・無変更検証で保全 |
| [packages/api/src/__tests__/db-errors.test.ts](../packages/api/src/__tests__/db-errors.test.ts) | api | review | PATH | isLabelConflictError：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/duplicate-tag-ids.test.ts](../packages/api/src/__tests__/duplicate-tag-ids.test.ts) | api | review | REG | unique tagIds input contract (SA2-210)：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/filter-preset.test.ts](../packages/api/src/__tests__/filter-preset.test.ts) | api | replace | AUTH-META | filterPreset router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/foreign-key-id-validation.test.ts](../packages/api/src/__tests__/foreign-key-id-validation.test.ts) | api | review | PATH | foreign-key id input validation：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/game-group.test.ts](../packages/api/src/__tests__/game-group.test.ts) | api | replace | AUTH-META, REG | gameGroup router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/game-masters.test.ts](../packages/api/src/__tests__/game-masters.test.ts) | api | review | PATH | RESERVED_LABELS：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/game-mix.test.ts](../packages/api/src/__tests__/game-mix.test.ts) | api | replace | AUTH-META, REG | gameMix router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/game-variant.test.ts](../packages/api/src/__tests__/game-variant.test.ts) | api | replace | AUTH-META, REG | gameVariant router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/live-cash-game-session.test.ts](../packages/api/src/__tests__/live-cash-game-session.test.ts) | api | replace | AUTH-META, DB-MOCK, REG | liveCashGameSession.create ownership validation (SA2-102)：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/live-cash-reopen.test.ts](../packages/api/src/__tests__/live-cash-reopen.test.ts) | api | replace | DB-MOCK, REG | persistCashSessionReopenEvents (SA2-211)：DB mockの永続化・認可・原子性を実D1へ移植する候補 |
| [packages/api/src/__tests__/live-session-pl.test.ts](../packages/api/src/__tests__/live-session-pl.test.ts) | api | review | REG | syncChipPurchaseResults：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/live-tournament-session.test.ts](../packages/api/src/__tests__/live-tournament-session.test.ts) | api | replace | AUTH-META, DB-MOCK, REG | liveTournamentSession.create ownership validation (SA2-102)：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/location.test.ts](../packages/api/src/__tests__/location.test.ts) | api | replace | AUTH-META | location router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/ownership-error-uniformity.test.ts](../packages/api/src/__tests__/ownership-error-uniformity.test.ts) | api | review | PATH | ownership failures hide resource existence：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/pagination.test.ts](../packages/api/src/__tests__/pagination.test.ts) | api | review | PATH | paginate：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/password-compare.test.ts](../packages/api/src/__tests__/password-compare.test.ts) | api | review | PATH | constantTimeEqual：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/player-tag.test.ts](../packages/api/src/__tests__/player-tag.test.ts) | api | replace | AUTH-META | playerTag router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/player.test.ts](../packages/api/src/__tests__/player.test.ts) | api | replace | AUTH-META, DB-MOCK, REG | player router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/ring-game.test.ts](../packages/api/src/__tests__/ring-game.test.ts) | api | replace | AUTH-META, DB-MOCK, REG | ringGame router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/room.test.ts](../packages/api/src/__tests__/room.test.ts) | api | replace | AUTH-META | room router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/seed-game-data-chunking.test.ts](../packages/api/src/__tests__/seed-game-data-chunking.test.ts) | api | review | PATH | seedDefaultGameData membership chunking (D1 100-bind-param cap)：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/seed-game-data-unresolvable-variant.test.ts](../packages/api/src/__tests__/seed-game-data-unresolvable-variant.test.ts) | api | review | PATH | seedDefaultGameData with an unresolvable mix variantKey：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/seed-game-data.test.ts](../packages/api/src/__tests__/seed-game-data.test.ts) | api | review | REG | seedDefaultGameData：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/session-event.test.ts](../packages/api/src/__tests__/session-event.test.ts) | api | replace | AUTH-META | sessionEvent router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/session-result-type.test.ts](../packages/api/src/__tests__/session-result-type.test.ts) | api | review | PATH | ensureSessionResultTypeId：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/session-table-player.test.ts](../packages/api/src/__tests__/session-table-player.test.ts) | api | replace | AUTH-META, DB-MOCK, REG | sessionTablePlayer router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/session-tag.test.ts](../packages/api/src/__tests__/session-tag.test.ts) | api | replace | AUTH-META | sessionTag router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/session.test.ts](../packages/api/src/__tests__/session.test.ts) | api | replace | DB-MOCK, REG | resolveEvCashOut：DB mockの永続化・認可・原子性を実D1へ移植する候補 |
| [packages/api/src/__tests__/stats.test.ts](../packages/api/src/__tests__/stats.test.ts) | api | replace | AUTH-META | stats router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/tournament-chip-purchase.test.ts](../packages/api/src/__tests__/tournament-chip-purchase.test.ts) | api | replace | AUTH-META, REG | tournamentChipPurchase router structure：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/tournament.test.ts](../packages/api/src/__tests__/tournament.test.ts) | api | replace | AUTH-META, DB-MOCK, REG | tournament router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/transaction-type-behavior.test.ts](../packages/api/src/__tests__/transaction-type-behavior.test.ts) | api | review | PATH | transactionType reserved name behavior：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/__tests__/transaction-type.test.ts](../packages/api/src/__tests__/transaction-type.test.ts) | api | replace | AUTH-META | transactionType router：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/__tests__/update-note-view.test.ts](../packages/api/src/__tests__/update-note-view.test.ts) | api | replace | AUTH-META | updateNoteView.markViewed concurrency：認証metadataを実拒否検証へ置換。入力契約は保全 |
| [packages/api/src/ai/__tests__/models.test.ts](../packages/api/src/ai/__tests__/models.test.ts) | api | review | PATH | AI model registry：シナリオ・実体境界・他層との重複を確認 |
| [packages/api/src/utils/__tests__/seat-position.test.ts](../packages/api/src/utils/__tests__/seat-position.test.ts) | api | keep | PATH | assertSeatPositionFitsTableSize：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [packages/api/src/utils/__tests__/session-event-time.test.ts](../packages/api/src/utils/__tests__/session-event-time.test.ts) | api | keep | REG | floorToMinute：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### db（32ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [packages/db/src/__tests__/currency.test.ts](../packages/db/src/__tests__/currency.test.ts) | db | replace | A, DB-META | Currency schema：列存在・notNull等の宣言反復を精査。制約は実SQLに移して保全 |
| [packages/db/src/__tests__/filter-preset-payload-schema.test.ts](../packages/db/src/__tests__/filter-preset-payload-schema.test.ts) | db | review | PATH | filterPresetScreenKeySchema：シナリオ・実体境界・他層との重複を確認 |
| [packages/db/src/__tests__/filter-preset-schema.test.ts](../packages/db/src/__tests__/filter-preset-schema.test.ts) | db | replace | DB-META | FilterPreset schema：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/game-group-schema.test.ts](../packages/db/src/__tests__/game-group-schema.test.ts) | db | replace | DB-META | GameGroup schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/game-mix-schema.test.ts](../packages/db/src/__tests__/game-mix-schema.test.ts) | db | replace | DB-META | GameMix schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/game-mix-variant-schema.test.ts](../packages/db/src/__tests__/game-mix-variant-schema.test.ts) | db | replace | DB-META | GameMixVariant schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/game-schemas.test.ts](../packages/db/src/__tests__/game-schemas.test.ts) | db | review | PATH | mixGameGroupSchema：シナリオ・実体境界・他層との重複を確認 |
| [packages/db/src/__tests__/game-variant-schema.test.ts](../packages/db/src/__tests__/game-variant-schema.test.ts) | db | replace | DB-META | GameVariant schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/game-variants.test.ts](../packages/db/src/__tests__/game-variants.test.ts) | db | review | PATH | DEFAULT_VARIANT_LABEL：シナリオ・実体境界・他層との重複を確認 |
| [packages/db/src/__tests__/migration-0041.test.ts](../packages/db/src/__tests__/migration-0041.test.ts) | db | keep | SQL, SKIP | (describe名の静的抽出なし)：実SQLiteでmigration／seedを保護。Bun専用実行を維持 |
| [packages/db/src/__tests__/migration-0044.test.ts](../packages/db/src/__tests__/migration-0044.test.ts) | db | keep | SQL, SKIP | (describe名の静的抽出なし)：実SQLiteでmigration／seedを保護。Bun専用実行を維持 |
| [packages/db/src/__tests__/migration-0045.test.ts](../packages/db/src/__tests__/migration-0045.test.ts) | db | keep | SQL, SKIP | (describe名の静的抽出なし)：実SQLiteでmigration／seedを保護。Bun専用実行を維持 |
| [packages/db/src/__tests__/migration-0046.test.ts](../packages/db/src/__tests__/migration-0046.test.ts) | db | keep | SQL, SKIP | (describe名の静的抽出なし)：実SQLiteでmigration／seedを保護。Bun専用実行を維持 |
| [packages/db/src/__tests__/migration-0049.test.ts](../packages/db/src/__tests__/migration-0049.test.ts) | db | keep | SQL, SKIP | defensive backfill of legacy game_mix.games rows：実SQLiteでmigration／seedを保護。Bun専用実行を維持 |
| [packages/db/src/__tests__/migration-0050.test.ts](../packages/db/src/__tests__/migration-0050.test.ts) | db | keep | SQL, SKIP | (describe名の静的抽出なし)：実SQLiteでmigration／seedを保護。Bun専用実行を維持 |
| [packages/db/src/__tests__/oauth-schema.test.ts](../packages/db/src/__tests__/oauth-schema.test.ts) | db | replace | DB-META | oauthApplication schema (better-auth mcp plugin)：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/player-schema.test.ts](../packages/db/src/__tests__/player-schema.test.ts) | db | replace | DB-META | PlayerToPlayerTag — indexes：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/preview-seed-restore.test.ts](../packages/db/src/__tests__/preview-seed-restore.test.ts) | db | keep | SQL, SKIP | (describe名の静的抽出なし)：実SQLiteでmigration／seedを保護。Bun専用実行を維持 |
| [packages/db/src/__tests__/ring-game.test.ts](../packages/db/src/__tests__/ring-game.test.ts) | db | replace | DB-META, REG | RingGame schema：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/room.test.ts](../packages/db/src/__tests__/room.test.ts) | db | replace | DB-META | Room schema：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-blind-level-schema.test.ts](../packages/db/src/__tests__/session-blind-level-schema.test.ts) | db | replace | DB-META | SessionBlindLevel schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-cash-detail-schema.test.ts](../packages/db/src/__tests__/session-cash-detail-schema.test.ts) | db | replace | DB-META | SessionCashDetail schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-chip-purchase-result-schema.test.ts](../packages/db/src/__tests__/session-chip-purchase-result-schema.test.ts) | db | replace | DB-META | SessionChipPurchaseResult schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-chip-purchase-schema.test.ts](../packages/db/src/__tests__/session-chip-purchase-schema.test.ts) | db | replace | DB-META | SessionChipPurchase schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-event-types.test.ts](../packages/db/src/__tests__/session-event-types.test.ts) | db | review | PATH | SESSION_STATUSES：シナリオ・実体境界・他層との重複を確認 |
| [packages/db/src/__tests__/session-event.test.ts](../packages/db/src/__tests__/session-event.test.ts) | db | replace | DB-META | SessionEvent schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-schema.test.ts](../packages/db/src/__tests__/session-schema.test.ts) | db | replace | DB-META | GameSession schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-tag-schema.test.ts](../packages/db/src/__tests__/session-tag-schema.test.ts) | db | replace | DB-META | SessionToSessionTag — indexes：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/session-tournament-detail-schema.test.ts](../packages/db/src/__tests__/session-tournament-detail-schema.test.ts) | db | replace | DB-META | SessionTournamentDetail schema — columns：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/tournament-session-end-payload.test.ts](../packages/db/src/__tests__/tournament-session-end-payload.test.ts) | db | review | PATH | tournamentSessionEndPayload placement integrity：シナリオ・実体境界・他層との重複を確認 |
| [packages/db/src/__tests__/tournament.test.ts](../packages/db/src/__tests__/tournament.test.ts) | db | replace | DB-META | Tournament schema：宣言assertを精査し重要な制約を実SQLへ移す |
| [packages/db/src/__tests__/update-note-view.test.ts](../packages/db/src/__tests__/update-note-view.test.ts) | db | replace | DB-META | UpdateNoteView schema：宣言assertを精査し重要な制約を実SQLへ移す |

### env（2ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [packages/env/src/__tests__/server.test.ts](../packages/env/src/__tests__/server.test.ts) | env | keep | PATH | createServerEnv：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [packages/env/src/__tests__/web.test.ts](../packages/env/src/__tests__/web.test.ts) | env | keep | PATH | createWebEnv：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### mcp（6ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [packages/mcp/src/__tests__/protocol.test.ts](../packages/mcp/src/__tests__/protocol.test.ts) | mcp | review | PATH | MCP protocol layer：シナリオ・実体境界・他層との重複を確認 |
| [packages/mcp/src/auth/__tests__/consent-html.test.ts](../packages/mcp/src/auth/__tests__/consent-html.test.ts) | mcp | review | PATH | renderConsentHtml：シナリオ・実体境界・他層との重複を確認 |
| [packages/mcp/src/auth/__tests__/mcp-session.test.ts](../packages/mcp/src/auth/__tests__/mcp-session.test.ts) | mcp | review | PATH | buildMcpSession：シナリオ・実体境界・他層との重複を確認 |
| [packages/mcp/src/lib/__tests__/errors.test.ts](../packages/mcp/src/lib/__tests__/errors.test.ts) | mcp | review | PATH | mapToolError：シナリオ・実体境界・他層との重複を確認 |
| [packages/mcp/src/tools/__tests__/call.test.ts](../packages/mcp/src/tools/__tests__/call.test.ts) | mcp | review | PATH | callTool：シナリオ・実体境界・他層との重複を確認 |
| [packages/mcp/src/tools/__tests__/coupling.test.ts](../packages/mcp/src/tools/__tests__/coupling.test.ts) | mcp | keep | A, AUTH-META | tool/router coupling：全公開／除外・schema一致は維持。expectProtected部分は実拒否検証へ |

### server（5ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/server/src/__tests__/auth-options.test.ts](../apps/server/src/__tests__/auth-options.test.ts) | server | review | PATH | buildAuthOptions：シナリオ・実体境界・他層との重複を確認 |
| [apps/server/src/__tests__/consent-gate.test.ts](../apps/server/src/__tests__/consent-gate.test.ts) | server | review | PATH | authorize consent gate wiring：シナリオ・実体境界・他層との重複を確認 |
| [apps/server/src/__tests__/mcp-route.test.ts](../apps/server/src/__tests__/mcp-route.test.ts) | server | review | REG | /mcp route：シナリオ・実体境界・他層との重複を確認 |
| [apps/server/src/__tests__/oauth-consent.test.ts](../apps/server/src/__tests__/oauth-consent.test.ts) | server | review | PATH | forceConsentPrompt：シナリオ・実体境界・他層との重複を確認 |
| [apps/server/src/__tests__/oauth-discovery.test.ts](../apps/server/src/__tests__/oauth-discovery.test.ts) | server | review | PATH | OAuth discovery endpoints：シナリオ・実体境界・他層との重複を確認 |

### web/auth（7ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/auth/pages/login-page/__tests__/use-login-page.test.ts](../apps/web/src/features/auth/pages/login-page/__tests__/use-login-page.test.ts) | web-dom | review | HOOK | useLoginPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/auth/pages/login-page/preview-auto-login/__tests__/use-preview-auto-login.test.ts](../apps/web/src/features/auth/pages/login-page/preview-auto-login/__tests__/use-preview-auto-login.test.ts) | web-dom | review | HOOK | usePreviewAutoLogin：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/auth/pages/login-page/sign-in-form/__tests__/use-sign-in.test.ts](../apps/web/src/features/auth/pages/login-page/sign-in-form/__tests__/use-sign-in.test.ts) | web-dom | review | HOOK | useSignIn：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/auth/pages/login-page/sign-in-form/sign-in-form.test.tsx](../apps/web/src/features/auth/pages/login-page/sign-in-form/sign-in-form.test.tsx) | web-dom | review | A | SignInForm：実フォーム操作は存在。実HTTP認証を補完し送信引数の契約を確認 |
| [apps/web/src/features/auth/pages/login-page/sign-up-form/__tests__/use-sign-up.test.ts](../apps/web/src/features/auth/pages/login-page/sign-up-form/__tests__/use-sign-up.test.ts) | web-dom | review | HOOK | useSignUp：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/auth/pages/login-page/sign-up-form/sign-up-form.test.tsx](../apps/web/src/features/auth/pages/login-page/sign-up-form/sign-up-form.test.tsx) | web-dom | review | PATH | SignUpForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/auth/utils/__tests__/oauth-redirect.test.ts](../apps/web/src/features/auth/utils/__tests__/oauth-redirect.test.ts) | web-node | keep | PATH | resolveMcpAuthorizeRedirect：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### web/currencies（19ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/currencies/components/currency-form/__tests__/use-currency-form.test.ts](../apps/web/src/features/currencies/components/currency-form/__tests__/use-currency-form.test.ts) | web-dom | review | HOOK | useCurrencyForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts](../apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts) | web-dom | replace | A, HOOK, QUERY, REG | useCurrencies：実同時pendingと再取得前rollbackへ置換。成功・失敗の保護を維持 |
| [apps/web/src/features/currencies/hooks/__tests__/use-transaction-types.test.ts](../apps/web/src/features/currencies/hooks/__tests__/use-transaction-types.test.ts) | web-dom | review | HOOK, QUERY | useTransactionTypes：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currencies-page/__tests__/currencies-page.test.tsx](../apps/web/src/features/currencies/pages/currencies-page/__tests__/currencies-page.test.tsx) | web-dom | consolidate | HOOK-MOCK | CurrenciesPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/currencies/pages/currencies-page/__tests__/use-currencies-page.test.ts](../apps/web/src/features/currencies/pages/currencies-page/__tests__/use-currencies-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useCurrenciesPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currencies-page/currency-list-card/__tests__/currency-list-card-skeleton.test.tsx](../apps/web/src/features/currencies/pages/currencies-page/currency-list-card/__tests__/currency-list-card-skeleton.test.tsx) | web-dom | consolidate | DOM | CurrencyListCardSkeleton：装飾固定を整理し必要なloading契約を画面へ集約 |
| [apps/web/src/features/currencies/pages/currencies-page/currency-list-card/__tests__/currency-list-card.test.tsx](../apps/web/src/features/currencies/pages/currencies-page/currency-list-card/__tests__/currency-list-card.test.tsx) | web-dom | review | PATH | CurrencyListCard：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currencies-page/currency-list/__tests__/currency-list.test.tsx](../apps/web/src/features/currencies/pages/currencies-page/currency-list/__tests__/currency-list.test.tsx) | web-dom | review | PATH | CurrencyList：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currency-detail-page/__tests__/currency-detail-page.test.tsx](../apps/web/src/features/currencies/pages/currency-detail-page/__tests__/currency-detail-page.test.tsx) | web-dom | consolidate | HOOK-MOCK | CurrencyDetailPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/currencies/pages/currency-detail-page/__tests__/use-currency-detail-page.test.ts](../apps/web/src/features/currencies/pages/currency-detail-page/__tests__/use-currency-detail-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useCurrencyDetailPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currency-detail-page/currency-balance-hero/__tests__/currency-balance-hero.test.tsx](../apps/web/src/features/currencies/pages/currency-detail-page/currency-balance-hero/__tests__/currency-balance-hero.test.tsx) | web-dom | review | DOM | CurrencyBalanceHero：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currency-detail-page/currency-description/__tests__/currency-description.test.tsx](../apps/web/src/features/currencies/pages/currency-detail-page/currency-description/__tests__/currency-description.test.tsx) | web-dom | review | PATH | CurrencyDescription：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currency-detail-page/currency-detail-skeleton/__tests__/currency-detail-skeleton.test.tsx](../apps/web/src/features/currencies/pages/currency-detail-page/currency-detail-skeleton/__tests__/currency-detail-skeleton.test.tsx) | web-dom | consolidate | DOM | CurrencyDetailSkeleton：装飾固定を整理し必要なloading契約を画面へ集約 |
| [apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/__tests__/transaction-form.test.tsx](../apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/__tests__/transaction-form.test.tsx) | web-dom | consolidate | HOOK-MOCK, DOM | TransactionFormV2：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/__tests__/use-transaction-form.test.ts](../apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/__tests__/use-transaction-form.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useTransactionForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/type-combobox/__tests__/use-type-combobox.test.ts](../apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/type-combobox/__tests__/use-type-combobox.test.ts) | web-dom | review | HOOK | useTypeCombobox：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/pages/currency-detail-page/transaction-list/__tests__/transaction-list.test.tsx](../apps/web/src/features/currencies/pages/currency-detail-page/transaction-list/__tests__/transaction-list.test.tsx) | web-dom | review | DOM | TransactionListV2：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/currencies/utils/__tests__/balance-format.test.ts](../apps/web/src/features/currencies/utils/__tests__/balance-format.test.ts) | web-node | keep | PATH | getBalanceDisplay：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/currencies/utils/__tests__/transaction-list-helpers.test.ts](../apps/web/src/features/currencies/utils/__tests__/transaction-list-helpers.test.ts) | web-node | keep | PATH | buildGroupFormatter：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### web/games（7ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/games/pages/games-page/__tests__/games-page.test.tsx](../apps/web/src/features/games/pages/games-page/__tests__/games-page.test.tsx) | web-dom | consolidate | HOOK-MOCK | GamesPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/games/pages/games-page/__tests__/use-games-page.test.ts](../apps/web/src/features/games/pages/games-page/__tests__/use-games-page.test.ts) | web-dom | review | HOOK, QUERY | useGamesPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/games/pages/games-page/delete-confirm-dialog/__tests__/delete-confirm-dialog.test.tsx](../apps/web/src/features/games/pages/games-page/delete-confirm-dialog/__tests__/delete-confirm-dialog.test.tsx) | web-dom | review | PATH | DeleteConfirmDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/games/pages/games-page/group-card/__tests__/group-card.test.tsx](../apps/web/src/features/games/pages/games-page/group-card/__tests__/group-card.test.tsx) | web-dom | review | DOM | GroupCard：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/games/pages/games-page/group-form-sheet/__tests__/use-group-form-sheet.test.ts](../apps/web/src/features/games/pages/games-page/group-form-sheet/__tests__/use-group-form-sheet.test.ts) | web-dom | review | HOOK, QUERY | useGroupFormSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/games/pages/games-page/mixes-card/__tests__/mixes-card.test.tsx](../apps/web/src/features/games/pages/games-page/mixes-card/__tests__/mixes-card.test.tsx) | web-dom | review | DOM, REG | MixesCard：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/games/pages/games-page/variant-form-sheet/__tests__/use-variant-form-sheet.test.ts](../apps/web/src/features/games/pages/games-page/variant-form-sheet/__tests__/use-variant-form-sheet.test.ts) | web-dom | review | HOOK, QUERY | useVariantFormSheet：シナリオ・実体境界・他層との重複を確認 |

### web/live-sessions（85ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/live-sessions/components/actions-drawer/actions-drawer.test.tsx](../apps/web/src/features/live-sessions/components/actions-drawer/actions-drawer.test.tsx) | web-dom | review | PATH | ActionsDrawer：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-game-scene/active-session-game-scene.test.tsx](../apps/web/src/features/live-sessions/components/active-session-game-scene/active-session-game-scene.test.tsx) | web-dom | consolidate | HOOK-MOCK, QUERY | ActiveSessionGameScene：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/components/active-session-scene/__tests__/use-active-session-scene-state.test.ts](../apps/web/src/features/live-sessions/components/active-session-scene/__tests__/use-active-session-scene-state.test.ts) | web-dom | review | HOOK-MOCK, HOOK, QUERY | useActiveSessionSceneState：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-scene/__tests__/use-active-session-scene.test.ts](../apps/web/src/features/live-sessions/components/active-session-scene/__tests__/use-active-session-scene.test.ts) | web-dom | review | HOOK | useActiveSessionScene：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-scene/active-session-scene.test.tsx](../apps/web/src/features/live-sessions/components/active-session-scene/active-session-scene.test.tsx) | web-dom | review | PATH | ActiveSessionScene：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-scene/game-settings-sheet/game-settings-sheet.test.tsx](../apps/web/src/features/live-sessions/components/active-session-scene/game-settings-sheet/game-settings-sheet.test.tsx) | web-dom | review | PATH | GameSettingsSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-scene/history-section/history-section.test.tsx](../apps/web/src/features/live-sessions/components/active-session-scene/history-section/history-section.test.tsx) | web-dom | review | PATH | HistorySection：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor/__tests__/use-empty-seat-editor.test.ts](../apps/web/src/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor/__tests__/use-empty-seat-editor.test.ts) | web-dom | review | HOOK | useEmptySeatEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor/empty-seat-editor.test.tsx](../apps/web/src/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor/empty-seat-editor.test.tsx) | web-dom | consolidate | HOOK-MOCK | EmptySeatEditor：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor/__tests__/use-occupied-seat-editor.test.ts](../apps/web/src/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor/__tests__/use-occupied-seat-editor.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useOccupiedSeatEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor/occupied-seat-editor.test.tsx](../apps/web/src/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor/occupied-seat-editor.test.tsx) | web-dom | consolidate | HOOK-MOCK | OccupiedSeatEditor：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/components/active-session-scene/seat-list/player-tag-badges/player-tag-badges.test.tsx](../apps/web/src/features/live-sessions/components/active-session-scene/seat-list/player-tag-badges/player-tag-badges.test.tsx) | web-dom | consolidate | HOOK-MOCK | PlayerTagBadges：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/components/active-session-scene/seat-list/seat-list.test.tsx](../apps/web/src/features/live-sessions/components/active-session-scene/seat-list/seat-list.test.tsx) | web-dom | review | PATH | SeatList：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/addon-bottom-sheet/__tests__/use-addon-form.test.ts](../apps/web/src/features/live-sessions/components/addon-bottom-sheet/__tests__/use-addon-form.test.ts) | web-dom | review | HOOK | useAddonForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/all-in-bottom-sheet/__tests__/use-all-in-form.test.ts](../apps/web/src/features/live-sessions/components/all-in-bottom-sheet/__tests__/use-all-in-form.test.ts) | web-dom | review | HOOK | useAllInForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/all-in-bottom-sheet/all-in-bottom-sheet.test.tsx](../apps/web/src/features/live-sessions/components/all-in-bottom-sheet/all-in-bottom-sheet.test.tsx) | web-dom | review | PATH | AllInBottomSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/assign-ring-game-dialog/__tests__/use-assign-ring-game.test.ts](../apps/web/src/features/live-sessions/components/assign-ring-game-dialog/__tests__/use-assign-ring-game.test.ts) | web-dom | review | HOOK, QUERY | useAssignRingGame：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/assign-tournament-dialog/__tests__/use-assign-tournament.test.ts](../apps/web/src/features/live-sessions/components/assign-tournament-dialog/__tests__/use-assign-tournament.test.ts) | web-dom | review | HOOK, QUERY | useAssignTournament：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/cash-game-complete-form/__tests__/use-cash-game-complete-form.test.ts](../apps/web/src/features/live-sessions/components/cash-game-complete-form/__tests__/use-cash-game-complete-form.test.ts) | web-dom | review | HOOK | useCashGameCompleteForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/cash-game-stack-form/__tests__/use-cash-game-stack-form.test.ts](../apps/web/src/features/live-sessions/components/cash-game-stack-form/__tests__/use-cash-game-stack-form.test.ts) | web-dom | review | HOOK | useCashGameStackForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/cash-game-stack-form/cash-game-stack-form.test.tsx](../apps/web/src/features/live-sessions/components/cash-game-stack-form/cash-game-stack-form.test.tsx) | web-dom | consolidate | HOOK-MOCK | CashGameStackForm：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/components/chip-purchase-sheet/chip-purchase-sheet.test.tsx](../apps/web/src/features/live-sessions/components/chip-purchase-sheet/chip-purchase-sheet.test.tsx) | web-dom | review | PATH | ChipPurchaseSheet (picker)：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/create-session-dialog/__tests__/create-session-dialog.test.tsx](../apps/web/src/features/live-sessions/components/create-session-dialog/__tests__/create-session-dialog.test.tsx) | web-dom | consolidate | HOOK-MOCK | CreateSessionDialog：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/components/create-session-dialog/__tests__/use-create-session-dialog.test.ts](../apps/web/src/features/live-sessions/components/create-session-dialog/__tests__/use-create-session-dialog.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useCreateSessionDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/create-session-dialog/live-session-form/__tests__/use-live-session-form.test.ts](../apps/web/src/features/live-sessions/components/create-session-dialog/live-session-form/__tests__/use-live-session-form.test.ts) | web-dom | review | HOOK, QUERY | useLiveSessionForm — rule disclosure：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/create-session-dialog/live-session-form/live-session-form.test.tsx](../apps/web/src/features/live-sessions/components/create-session-dialog/live-session-form/live-session-form.test.tsx) | web-dom | review | QUERY | LiveSessionForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/create-session-dialog/set-room-location-dialog/set-room-location-dialog.test.tsx](../apps/web/src/features/live-sessions/components/create-session-dialog/set-room-location-dialog/set-room-location-dialog.test.tsx) | web-dom | review | PATH | SetRoomLocationDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-badge/event-badge.test.tsx](../apps/web/src/features/live-sessions/components/event-badge/event-badge.test.tsx) | web-dom | review | PATH | EventBadge：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/all-in-editor/__tests__/use-all-in-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/all-in-editor/__tests__/use-all-in-editor.test.ts) | web-dom | review | HOOK | useAllInEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/chips-add-remove-editor/__tests__/use-chips-add-remove-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/chips-add-remove-editor/__tests__/use-chips-add-remove-editor.test.ts) | web-dom | review | HOOK | useChipsAddRemoveEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/memo-editor/__tests__/use-memo-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/memo-editor/__tests__/use-memo-editor.test.ts) | web-dom | review | HOOK | useMemoEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/purchase-chips-editor/__tests__/use-purchase-chips-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/purchase-chips-editor/__tests__/use-purchase-chips-editor.test.ts) | web-dom | review | HOOK | usePurchaseChipsEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/session-end-editor/__tests__/use-session-end-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/session-end-editor/__tests__/use-session-end-editor.test.ts) | web-dom | review | HOOK | useCashGameEndEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/session-start-editor/__tests__/use-session-start-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/session-start-editor/__tests__/use-session-start-editor.test.ts) | web-dom | review | HOOK | useCashGameStartEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/time-only-editor/__tests__/use-time-only-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/time-only-editor/__tests__/use-time-only-editor.test.ts) | web-dom | review | HOOK | useTimeOnlyEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/event-editors/update-stack-editor/__tests__/use-update-stack-editor.test.ts](../apps/web/src/features/live-sessions/components/event-editors/update-stack-editor/__tests__/use-update-stack-editor.test.ts) | web-dom | review | HOOK | useUpdateStackEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/live-stack-form-sheet/__tests__/use-live-stack-form-sheet.test.ts](../apps/web/src/features/live-sessions/components/live-stack-form-sheet/__tests__/use-live-stack-form-sheet.test.ts) | web-dom | review | HOOK | useCashGameStackSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/live-stack-form-sheet/live-stack-form-sheet.test.tsx](../apps/web/src/features/live-sessions/components/live-stack-form-sheet/live-stack-form-sheet.test.tsx) | web-dom | consolidate | HOOK-MOCK, QUERY | LiveStackFormSheet：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/components/seat-from-screenshot-sheet/__tests__/use-seat-from-screenshot.test.ts](../apps/web/src/features/live-sessions/components/seat-from-screenshot-sheet/__tests__/use-seat-from-screenshot.test.ts) | web-dom | review | HOOK, QUERY | useSeatFromScreenshot：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/session-events-scene/__tests__/use-session-events-scene.test.ts](../apps/web/src/features/live-sessions/components/session-events-scene/__tests__/use-session-events-scene.test.ts) | web-dom | review | HOOK, QUERY | useSessionEventsScene：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/session-events-scene/session-events-scene.test.tsx](../apps/web/src/features/live-sessions/components/session-events-scene/session-events-scene.test.tsx) | web-dom | review | QUERY | SessionEventsScene：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/session-result-chart/__tests__/session-result-chart-impl.test.tsx](../apps/web/src/features/live-sessions/components/session-result-chart/__tests__/session-result-chart-impl.test.tsx) | web-dom | review | PATH | SessionResultChartImpl：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/session-result-chart/__tests__/session-result-chart.test.tsx](../apps/web/src/features/live-sessions/components/session-result-chart/__tests__/session-result-chart.test.tsx) | web-dom | review | QUERY | SessionResultChart：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/session-result-chart/__tests__/use-session-result-chart.test.ts](../apps/web/src/features/live-sessions/components/session-result-chart/__tests__/use-session-result-chart.test.ts) | web-dom | review | HOOK, QUERY | useSessionResultChart：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/stack-record-editor/__tests__/use-stack-record-editor.test.ts](../apps/web/src/features/live-sessions/components/stack-record-editor/__tests__/use-stack-record-editor.test.ts) | web-dom | review | HOOK | useStackRecordEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/stack-record-editor/stack-record-editor.test.tsx](../apps/web/src/features/live-sessions/components/stack-record-editor/stack-record-editor.test.tsx) | web-dom | review | PATH | StackRecordEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/tournament-complete-form/__tests__/use-tournament-complete-form.test.ts](../apps/web/src/features/live-sessions/components/tournament-complete-form/__tests__/use-tournament-complete-form.test.ts) | web-dom | review | HOOK | useTournamentCompleteForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/tournament-stack-form/__tests__/use-tournament-stack-form.test.ts](../apps/web/src/features/live-sessions/components/tournament-stack-form/__tests__/use-tournament-stack-form.test.ts) | web-dom | review | HOOK | useTournamentStackForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/components/tournament-stack-form/tournament-stack-form.test.tsx](../apps/web/src/features/live-sessions/components/tournament-stack-form/tournament-stack-form.test.tsx) | web-dom | consolidate | HOOK-MOCK | TournamentStackForm：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-active-session.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-active-session.test.ts) | web-dom | review | HOOK, QUERY | useActiveSession：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-assign-dialog-state.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-assign-dialog-state.test.ts) | web-dom | review | HOOK | useAssignDialogState：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-cash-game-session.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-cash-game-session.test.ts) | web-dom | review | HOOK, QUERY | useCashGameSession：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-cash-game-stack.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-cash-game-stack.test.ts) | web-dom | review | HOOK, QUERY | useCashGameStack：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-create-session.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-create-session.test.ts) | web-dom | review | HOOK-MOCK, HOOK, QUERY, REG | useCreateSession：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-ring-game-scene-actions.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-ring-game-scene-actions.test.ts) | web-dom | review | HOOK, QUERY | useRingGameSceneActions：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-seat-combobox.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-seat-combobox.test.ts) | web-dom | review | HOOK | useSeatCombobox：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-session-events.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-session-events.test.ts) | web-dom | review | HOOK, QUERY, REG | useSessionEvents：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-session-form.test.tsx](../apps/web/src/features/live-sessions/hooks/__tests__/use-session-form.test.tsx) | web-dom | review | HOOK | SessionFormProvider：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-session-tournament-structure.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-session-tournament-structure.test.ts) | web-dom | review | HOOK, QUERY | useSessionTournamentStructure：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-detail.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-detail.test.ts) | web-dom | review | HOOK, QUERY | useTournamentDetail：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-scene-actions.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-scene-actions.test.ts) | web-dom | review | HOOK, QUERY | useTournamentSceneActions：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-session.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-session.test.ts) | web-dom | review | HOOK, QUERY | useTournamentSession：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-stack.test.ts](../apps/web/src/features/live-sessions/hooks/__tests__/use-tournament-stack.test.ts) | web-dom | review | HOOK, QUERY | useTournamentStack：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/__tests__/active-session-page.test.tsx](../apps/web/src/features/live-sessions/pages/active-session-page/__tests__/active-session-page.test.tsx) | web-dom | consolidate | HOOK-MOCK | ActiveSessionPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/live-sessions/pages/active-session-page/cash-game-compact-summary/__tests__/use-cash-game-compact-summary.test.ts](../apps/web/src/features/live-sessions/pages/active-session-page/cash-game-compact-summary/__tests__/use-cash-game-compact-summary.test.ts) | web-dom | review | HOOK-MOCK, HOOK, REG | useCashGameCompactSummary：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/cash-game-session/__tests__/use-cash-game-session-view.test.ts](../apps/web/src/features/live-sessions/pages/active-session-page/cash-game-session/__tests__/use-cash-game-session-view.test.ts) | web-dom | review | HOOK-MOCK, HOOK, REG | useCashGameSessionView：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/memo-form-sheet/__tests__/use-memo-form-sheet.test.ts](../apps/web/src/features/live-sessions/pages/active-session-page/memo-form-sheet/__tests__/use-memo-form-sheet.test.ts) | web-dom | review | HOOK | useMemoFormSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/tournament-compact-summary/__tests__/use-tournament-compact-summary.test.ts](../apps/web/src/features/live-sessions/pages/active-session-page/tournament-compact-summary/__tests__/use-tournament-compact-summary.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useTournamentCompactSummary：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/__tests__/use-tournament-session-view.test.ts](../apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/__tests__/use-tournament-session-view.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useTournamentSessionView：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer-dialog/__tests__/use-tournament-timer-dialog.test.ts](../apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer-dialog/__tests__/use-tournament-timer-dialog.test.ts) | web-dom | review | HOOK | useTournamentTimerDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer/__tests__/use-tournament-timer-scene.test.ts](../apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer/__tests__/use-tournament-timer-scene.test.ts) | web-dom | review | HOOK | useNowTick：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer/tournament-timer.test.tsx](../apps/web/src/features/live-sessions/pages/active-session-page/tournament-session/tournament-timer/tournament-timer.test.tsx) | web-dom | review | PATH | TournamentTimer：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/live-sessions/utils/__tests__/all-in-validation.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/all-in-validation.test.ts) | web-node | keep | PATH | refineWinsNotExceedingTrials：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/create-tournament-session-form-helpers.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/create-tournament-session-form-helpers.test.ts) | web-node | keep | PATH | parseTimerStartedAt：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/game-scene-formatters.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/game-scene-formatters.test.ts) | web-node | keep | PATH | variantLabel：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/geo.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/geo.test.ts) | web-node | keep | PATH | haversineMeters：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/memo-excerpt.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/memo-excerpt.test.ts) | web-node | keep | PATH | memoExcerpt：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/optimistic-session-event.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/optimistic-session-event.test.ts) | web-node | keep | QUERY, REG | buildOptimisticSessionSummary：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/seat-screenshot.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/seat-screenshot.test.ts) | web-node | keep | PATH | isAcceptedMediaType：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/session-events-formatters.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/session-events-formatters.test.ts) | web-node | keep | PATH | LIFECYCLE_EVENTS：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/session-timeline.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/session-timeline.test.ts) | web-node | keep | PATH | deriveCashGameTimeline：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/snapshot-diff.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/snapshot-diff.test.ts) | web-node | keep | PATH | diffCashSnapshot — mixGames：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/stack-editor-time.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/stack-editor-time.test.ts) | web-node | keep | PATH | toTimeInputValue：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/tag-overflow.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/tag-overflow.test.ts) | web-node | keep | PATH | computeVisibleTagCount：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/live-sessions/utils/__tests__/tournament-timer.test.ts](../apps/web/src/features/live-sessions/utils/__tests__/tournament-timer.test.ts) | web-node | keep | PATH | computeTournamentTimerState：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### web/players（19ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/players/components/player-form/__tests__/use-player-form.test.ts](../apps/web/src/features/players/components/player-form/__tests__/use-player-form.test.ts) | web-dom | review | HOOK | usePlayerForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/components/player-form/player-form.test.tsx](../apps/web/src/features/players/components/player-form/player-form.test.tsx) | web-dom | review | PATH | PlayerForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/components/player-tag-input/player-tag-input.test.tsx](../apps/web/src/features/players/components/player-tag-input/player-tag-input.test.tsx) | web-dom | review | PATH | PlayerTagInput：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/hooks/__tests__/use-player-detail.test.ts](../apps/web/src/features/players/hooks/__tests__/use-player-detail.test.ts) | web-dom | review | HOOK, QUERY | usePlayerDetail：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/hooks/__tests__/use-player-tags.test.ts](../apps/web/src/features/players/hooks/__tests__/use-player-tags.test.ts) | web-dom | review | HOOK, QUERY | usePlayerTags：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/hooks/__tests__/use-players.test.ts](../apps/web/src/features/players/hooks/__tests__/use-players.test.ts) | web-dom | review | HOOK, QUERY | usePlayers：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/hooks/__tests__/use-table-players.test.ts](../apps/web/src/features/players/hooks/__tests__/use-table-players.test.ts) | web-dom | review | HOOK, QUERY | useTablePlayers：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/player-detail-page/__tests__/player-detail-page.test.tsx](../apps/web/src/features/players/pages/player-detail-page/__tests__/player-detail-page.test.tsx) | web-dom | consolidate | HOOK-MOCK | PlayerDetailPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/players/pages/player-detail-page/__tests__/use-player-detail-page.test.ts](../apps/web/src/features/players/pages/player-detail-page/__tests__/use-player-detail-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | usePlayerDetailPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/player-detail-page/delete-player-dialog/delete-player-dialog.test.tsx](../apps/web/src/features/players/pages/player-detail-page/delete-player-dialog/delete-player-dialog.test.tsx) | web-dom | review | PATH | DeletePlayerDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/player-detail-page/player-actions-drawer/player-actions-drawer.test.tsx](../apps/web/src/features/players/pages/player-detail-page/player-actions-drawer/player-actions-drawer.test.tsx) | web-dom | review | PATH | PlayerActionsDrawer：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/player-detail-page/player-detail-skeleton/__tests__/player-detail-skeleton.test.tsx](../apps/web/src/features/players/pages/player-detail-page/player-detail-skeleton/__tests__/player-detail-skeleton.test.tsx) | web-dom | consolidate | DOM | PlayerDetailSkeleton：装飾固定を整理し必要なloading契約を画面へ集約 |
| [apps/web/src/features/players/pages/player-detail-page/top-bar/__tests__/top-bar.test.tsx](../apps/web/src/features/players/pages/player-detail-page/top-bar/__tests__/top-bar.test.tsx) | web-dom | review | PATH | TopBar：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/players-page/__tests__/players-page.test.tsx](../apps/web/src/features/players/pages/players-page/__tests__/players-page.test.tsx) | web-dom | replace | A, HOOK-MOCK | PlayersPage：実hook・フォーム・通信境界を用いる検索／保存／失敗の操作へ置換 |
| [apps/web/src/features/players/pages/players-page/__tests__/use-players-page.test.ts](../apps/web/src/features/players/pages/players-page/__tests__/use-players-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | usePlayersPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/players-page/player-list-card/__tests__/player-list-card-skeleton.test.tsx](../apps/web/src/features/players/pages/players-page/player-list-card/__tests__/player-list-card-skeleton.test.tsx) | web-dom | consolidate | A, DOM | PlayerListCardSkeleton：高さ・色・placeholder数のみ固定。装飾assert削除の候補 |
| [apps/web/src/features/players/pages/players-page/player-list-card/__tests__/player-list-card.test.tsx](../apps/web/src/features/players/pages/players-page/player-list-card/__tests__/player-list-card.test.tsx) | web-dom | review | DOM | PlayerListCard：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/players-page/player-list/__tests__/player-list.test.tsx](../apps/web/src/features/players/pages/players-page/player-list/__tests__/player-list.test.tsx) | web-dom | review | PATH | PlayerList：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/players/pages/players-page/player-search/__tests__/player-search.test.tsx](../apps/web/src/features/players/pages/players-page/player-search/__tests__/player-search.test.tsx) | web-dom | review | PATH | PlayerSearch：シナリオ・実体境界・他層との重複を確認 |

### web/rooms（49ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/rooms/components/blind-level-editor/__tests__/use-blind-level-editor.test.ts](../apps/web/src/features/rooms/components/blind-level-editor/__tests__/use-blind-level-editor.test.ts) | web-dom | review | HOOK | useLocalBlindStructure：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/blind-level-editor/blind-level-editor.test.tsx](../apps/web/src/features/rooms/components/blind-level-editor/blind-level-editor.test.tsx) | web-dom | review | QUERY | BlindStructureContent：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/blind-level-editor/blind-level-input/blind-level-input.test.tsx](../apps/web/src/features/rooms/components/blind-level-editor/blind-level-input/blind-level-input.test.tsx) | web-dom | review | DOM, REG | BlindLevelInput：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/blind-level-editor/blind-structure-table/blind-structure-table.test.tsx](../apps/web/src/features/rooms/components/blind-level-editor/blind-structure-table/blind-structure-table.test.tsx) | web-dom | review | PATH | BlindStructureTable add actions：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/blind-level-editor/empty-game-set-rows/__tests__/use-empty-game-set-rows-view.test.ts](../apps/web/src/features/rooms/components/blind-level-editor/empty-game-set-rows/__tests__/use-empty-game-set-rows-view.test.ts) | web-dom | review | HOOK | useEmptyGameSetRowsView：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/blind-level-editor/level-patterns-sheet/__tests__/use-level-patterns-sheet.test.ts](../apps/web/src/features/rooms/components/blind-level-editor/level-patterns-sheet/__tests__/use-level-patterns-sheet.test.ts) | web-dom | review | HOOK, REG | useLevelPatternsSheet — assign mode (per-level variants)：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/delete-game-dialog/__tests__/delete-game-dialog.test.tsx](../apps/web/src/features/rooms/components/delete-game-dialog/__tests__/delete-game-dialog.test.tsx) | web-dom | review | PATH | DeleteGameDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/game-actions-drawer/__tests__/game-actions-drawer.test.tsx](../apps/web/src/features/rooms/components/game-actions-drawer/__tests__/game-actions-drawer.test.tsx) | web-dom | review | PATH | GameActionsDrawer：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/ring-game-form/__tests__/use-ring-game-form.test.ts](../apps/web/src/features/rooms/components/ring-game-form/__tests__/use-ring-game-form.test.ts) | web-dom | review | HOOK, QUERY | useRingGameForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/ring-game-form/ring-game-form.test.tsx](../apps/web/src/features/rooms/components/ring-game-form/ring-game-form.test.tsx) | web-dom | review | QUERY | RingGameForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/room-form/__tests__/use-room-form.test.ts](../apps/web/src/features/rooms/components/room-form/__tests__/use-room-form.test.ts) | web-dom | review | HOOK | useRoomForm — fields：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/room-form/location-picker/__tests__/maps-url.test.ts](../apps/web/src/features/rooms/components/room-form/location-picker/__tests__/maps-url.test.ts) | web-dom | review | PATH | isGoogleMapsUrl：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/room-form/location-picker/__tests__/use-location-picker.test.ts](../apps/web/src/features/rooms/components/room-form/location-picker/__tests__/use-location-picker.test.ts) | web-dom | review | HOOK-MOCK, HOOK, QUERY | useLocationPicker：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/room-form/location-picker/location-picker.test.tsx](../apps/web/src/features/rooms/components/room-form/location-picker/location-picker.test.tsx) | web-dom | consolidate | HOOK-MOCK, DOM | LocationPicker：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/rooms/components/tournament-form-sheet/__tests__/use-tournament-form-sheet.test.ts](../apps/web/src/features/rooms/components/tournament-form-sheet/__tests__/use-tournament-form-sheet.test.ts) | web-dom | review | HOOK | useTournamentFormSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/tournament-form-sheet/ai-extract-input/__tests__/use-ai-extract-input.test.ts](../apps/web/src/features/rooms/components/tournament-form-sheet/ai-extract-input/__tests__/use-ai-extract-input.test.ts) | web-dom | review | HOOK, QUERY | useAiExtractInput：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/tournament-form-sheet/tournament-form-sheet.test.tsx](../apps/web/src/features/rooms/components/tournament-form-sheet/tournament-form-sheet.test.tsx) | web-dom | consolidate | HOOK-MOCK | TournamentFormSheet：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/rooms/components/tournament-modal-content/__tests__/tournament-modal-content.test.tsx](../apps/web/src/features/rooms/components/tournament-modal-content/__tests__/tournament-modal-content.test.tsx) | web-dom | consolidate | HOOK-MOCK, QUERY, REG | TournamentModalContent：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/rooms/components/tournament-modal-content/__tests__/use-tournament-modal-content.test.ts](../apps/web/src/features/rooms/components/tournament-modal-content/__tests__/use-tournament-modal-content.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useTournamentModalContent：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/__tests__/use-tournament-form.test.ts](../apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/__tests__/use-tournament-form.test.ts) | web-dom | review | HOOK, QUERY | useTournamentForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/tournament-form.test.tsx](../apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/tournament-form.test.tsx) | web-dom | review | QUERY | TournamentForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-blind-levels.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-blind-levels.test.ts) | web-dom | review | HOOK, QUERY, REG | useBlindLevels：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-empty-games-row.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-empty-games-row.test.ts) | web-dom | review | HOOK | useEmptyGamesRow：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-empty-row.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-empty-row.test.ts) | web-dom | review | HOOK | useEmptyRow：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-game-set-rows.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-game-set-rows.test.ts) | web-dom | review | HOOK | useGameSetRows：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-ring-games.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-ring-games.test.ts) | web-dom | review | HOOK, QUERY | useRingGames：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-room-games.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-room-games.test.ts) | web-dom | review | HOOK, QUERY | useRoomGames：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-rooms.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-rooms.test.ts) | web-dom | review | HOOK, QUERY | useRooms：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-sortable-level-row.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-sortable-level-row.test.ts) | web-dom | review | HOOK | useSortableLevelRow：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/hooks/__tests__/use-tournaments.test.ts](../apps/web/src/features/rooms/hooks/__tests__/use-tournaments.test.ts) | web-dom | review | HOOK, QUERY | useTournaments：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/__tests__/room-detail-page.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/__tests__/room-detail-page.test.tsx) | web-dom | consolidate | HOOK-MOCK | RoomDetailPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/rooms/pages/room-detail-page/__tests__/use-room-detail-page.test.ts](../apps/web/src/features/rooms/pages/room-detail-page/__tests__/use-room-detail-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useRoomDetailPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/delete-room-dialog/__tests__/delete-room-dialog.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/delete-room-dialog/__tests__/delete-room-dialog.test.tsx) | web-dom | review | PATH | DeleteRoomDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/ring-game-tab/__tests__/use-ring-game-tab.test.ts](../apps/web/src/features/rooms/pages/room-detail-page/ring-game-tab/__tests__/use-ring-game-tab.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useRingGameTab：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/ring-game-tab/ring-game-tab.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/ring-game-tab/ring-game-tab.test.tsx) | web-dom | consolidate | HOOK-MOCK | RingGameTab：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/rooms/pages/room-detail-page/room-actions-drawer/__tests__/room-actions-drawer.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/room-actions-drawer/__tests__/room-actions-drawer.test.tsx) | web-dom | review | PATH | RoomActionsDrawer：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/room-detail-skeleton/__tests__/room-detail-skeleton.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/room-detail-skeleton/__tests__/room-detail-skeleton.test.tsx) | web-dom | consolidate | DOM | RoomDetailSkeleton：装飾固定を整理し必要なloading契約を画面へ集約 |
| [apps/web/src/features/rooms/pages/room-detail-page/room-location-link/__tests__/room-location-link.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/room-location-link/__tests__/room-location-link.test.tsx) | web-dom | review | PATH | RoomLocationLink：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/top-bar/__tests__/top-bar.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/top-bar/__tests__/top-bar.test.tsx) | web-dom | review | PATH | RoomDetail TopBar：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/tournament-tab/__tests__/use-tournament-tab.test.ts](../apps/web/src/features/rooms/pages/room-detail-page/tournament-tab/__tests__/use-tournament-tab.test.ts) | web-dom | review | HOOK-MOCK, HOOK, QUERY | useTournamentTab：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/room-detail-page/tournament-tab/tournament-tab.test.tsx](../apps/web/src/features/rooms/pages/room-detail-page/tournament-tab/tournament-tab.test.tsx) | web-dom | consolidate | HOOK-MOCK | TournamentTab：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/rooms/pages/rooms-page/__tests__/rooms-page.test.tsx](../apps/web/src/features/rooms/pages/rooms-page/__tests__/rooms-page.test.tsx) | web-dom | consolidate | HOOK-MOCK | RoomsPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/rooms/pages/rooms-page/__tests__/use-rooms-page.test.ts](../apps/web/src/features/rooms/pages/rooms-page/__tests__/use-rooms-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useRoomsPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/rooms-page/room-list-card/__tests__/room-list-card-skeleton.test.tsx](../apps/web/src/features/rooms/pages/rooms-page/room-list-card/__tests__/room-list-card-skeleton.test.tsx) | web-dom | consolidate | DOM | RoomListCardSkeleton：装飾固定を整理し必要なloading契約を画面へ集約 |
| [apps/web/src/features/rooms/pages/rooms-page/room-list-card/__tests__/room-list-card.test.tsx](../apps/web/src/features/rooms/pages/rooms-page/room-list-card/__tests__/room-list-card.test.tsx) | web-dom | review | PATH | RoomListCard：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/pages/rooms-page/room-list/__tests__/room-list.test.tsx](../apps/web/src/features/rooms/pages/rooms-page/room-list/__tests__/room-list.test.tsx) | web-dom | review | PATH | RoomList：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/rooms/utils/__tests__/blind-level-helpers.test.ts](../apps/web/src/features/rooms/utils/__tests__/blind-level-helpers.test.ts) | web-node | keep | PATH | getEffectiveLastMinutes：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/rooms/utils/__tests__/game-format.test.ts](../apps/web/src/features/rooms/utils/__tests__/game-format.test.ts) | web-node | keep | PATH | formatRingGameBlinds：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/rooms/utils/__tests__/merge-extracted-tournament-data.test.ts](../apps/web/src/features/rooms/utils/__tests__/merge-extracted-tournament-data.test.ts) | web-node | keep | PATH | mergeExtractedTournamentData：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### web/sessions（34ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/sessions/components/override-label/__tests__/override-label.test.tsx](../apps/web/src/features/sessions/components/override-label/__tests__/override-label.test.tsx) | web-dom | review | PATH | OverrideLabel：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-filter-bar/__tests__/use-session-filter-bar.test.ts](../apps/web/src/features/sessions/components/session-filter-bar/__tests__/use-session-filter-bar.test.ts) | web-dom | review | HOOK | useSessionFilterBar：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-form-sheet/__tests__/session-form-sheet.test.tsx](../apps/web/src/features/sessions/components/session-form-sheet/__tests__/session-form-sheet.test.tsx) | web-dom | review | PATH | SessionFormSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-wizard/__tests__/chip-purchase-rows.test.ts](../apps/web/src/features/sessions/components/session-wizard/__tests__/chip-purchase-rows.test.ts) | web-dom | review | PATH | toChipPurchaseRows：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-wizard/__tests__/use-session-form-state.test.ts](../apps/web/src/features/sessions/components/session-wizard/__tests__/use-session-form-state.test.ts) | web-dom | review | HOOK, QUERY | useSessionFormState：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-wizard/__tests__/use-session-wizard.test.ts](../apps/web/src/features/sessions/components/session-wizard/__tests__/use-session-wizard.test.ts) | web-dom | review | HOOK-MOCK, HOOK | wizardStepsForMode：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-wizard/rules-step-body/cash-rules-step-body/cash-game-fields/cash-blind-fields/cash-blind-fields.test.tsx](../apps/web/src/features/sessions/components/session-wizard/rules-step-body/cash-rules-step-body/cash-game-fields/cash-blind-fields/cash-blind-fields.test.tsx) | web-dom | consolidate | HOOK-MOCK | CashBlindFields：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/sessions/components/session-wizard/rules-step-body/cash-rules-step-body/cash-game-fields/cash-game-fields.test.tsx](../apps/web/src/features/sessions/components/session-wizard/rules-step-body/cash-rules-step-body/cash-game-fields/cash-game-fields.test.tsx) | web-dom | consolidate | HOOK-MOCK | CashGameFields：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/sessions/components/session-wizard/rules-step-body/rules-step-body.test.tsx](../apps/web/src/features/sessions/components/session-wizard/rules-step-body/rules-step-body.test.tsx) | web-dom | review | HOOK, QUERY | RulesStepBody — override badges：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-wizard/session-wizard.test.tsx](../apps/web/src/features/sessions/components/session-wizard/session-wizard.test.tsx) | web-dom | review | QUERY | SessionWizard — step gating：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/components/session-wizard/tournament-fields/chip-purchase-count-row/chip-purchase-count-row.test.tsx](../apps/web/src/features/sessions/components/session-wizard/tournament-fields/chip-purchase-count-row/chip-purchase-count-row.test.tsx) | web-dom | review | PATH | ChipPurchaseCountRow：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/hooks/__tests__/use-session-detail.test.ts](../apps/web/src/features/sessions/hooks/__tests__/use-session-detail.test.ts) | web-dom | review | HOOK, QUERY | useSessionDetail：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/hooks/__tests__/use-sessions.test.ts](../apps/web/src/features/sessions/hooks/__tests__/use-sessions.test.ts) | web-dom | review | HOOK, QUERY, REG | pure helpers：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/__tests__/session-detail-page.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/__tests__/session-detail-page.test.tsx) | web-dom | consolidate | HOOK-MOCK, DOM | SessionDetailPage：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/sessions/pages/session-detail-page/__tests__/use-live-linked-session-edit.test.ts](../apps/web/src/features/sessions/pages/session-detail-page/__tests__/use-live-linked-session-edit.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useLiveLinkedSessionEdit：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/__tests__/use-session-detail-page.test.ts](../apps/web/src/features/sessions/pages/session-detail-page/__tests__/use-session-detail-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useSessionDetailPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/delete-session-dialog/__tests__/delete-session-dialog.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/delete-session-dialog/__tests__/delete-session-dialog.test.tsx) | web-dom | review | PATH | DeleteSessionDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/session-actions-drawer/__tests__/session-actions-drawer.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/session-actions-drawer/__tests__/session-actions-drawer.test.tsx) | web-dom | review | PATH | SessionActionsDrawer：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/session-edit-form/__tests__/session-edit-form.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/session-edit-form/__tests__/session-edit-form.test.tsx) | web-dom | review | QUERY | SessionEditForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/session-edit-form/__tests__/use-session-edit-form.test.ts](../apps/web/src/features/sessions/pages/session-detail-page/session-edit-form/__tests__/use-session-edit-form.test.ts) | web-dom | review | HOOK, QUERY | useSessionEditForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/session-pl-hero/__tests__/session-pl-hero.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/session-pl-hero/__tests__/session-pl-hero.test.tsx) | web-dom | review | PATH | SessionPlHero：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/session-stat-list/__tests__/session-stat-list.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/session-stat-list/__tests__/session-stat-list.test.tsx) | web-dom | review | PATH | SessionStatList：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/session-timeline/__tests__/session-timeline.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/session-timeline/__tests__/session-timeline.test.tsx) | web-dom | review | PATH | SessionTimeline：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/session-detail-page/top-bar/__tests__/top-bar.test.tsx](../apps/web/src/features/sessions/pages/session-detail-page/top-bar/__tests__/top-bar.test.tsx) | web-dom | review | PATH | TopBar：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/sessions-page/__tests__/use-sessions-page.test.ts](../apps/web/src/features/sessions/pages/sessions-page/__tests__/use-sessions-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useSessionsPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/sessions-page/session-list-card/__tests__/session-list-card.test.tsx](../apps/web/src/features/sessions/pages/sessions-page/session-list-card/__tests__/session-list-card.test.tsx) | web-dom | review | DOM | SessionListCard：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/sessions-page/session-list/__tests__/session-list.test.tsx](../apps/web/src/features/sessions/pages/sessions-page/session-list/__tests__/session-list.test.tsx) | web-dom | review | PATH | SessionList：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/sessions-page/session-tag-manager/__tests__/use-session-tags.test.ts](../apps/web/src/features/sessions/pages/sessions-page/session-tag-manager/__tests__/use-session-tags.test.ts) | web-dom | review | HOOK, QUERY | useSessionTags：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/pages/sessions-page/session-tag-manager/session-tag-manager.test.tsx](../apps/web/src/features/sessions/pages/sessions-page/session-tag-manager/session-tag-manager.test.tsx) | web-dom | review | QUERY | SessionTagManager：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/sessions/utils/__tests__/live-linked-edit.test.ts](../apps/web/src/features/sessions/utils/__tests__/live-linked-edit.test.ts) | web-node | keep | REG | findLifecycleEvents：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/sessions/utils/__tests__/session-display.test.ts](../apps/web/src/features/sessions/utils/__tests__/session-display.test.ts) | web-node | keep | REG | getSessionGameName：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/sessions/utils/__tests__/session-filters-helpers.test.ts](../apps/web/src/features/sessions/utils/__tests__/session-filters-helpers.test.ts) | web-node | keep | PATH | SESSION_TYPE_LABEL：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/sessions/utils/__tests__/session-form-helpers.test.ts](../apps/web/src/features/sessions/utils/__tests__/session-form-helpers.test.ts) | web-node | keep | PATH | NONE_VALUE：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/sessions/utils/__tests__/share-session.test.ts](../apps/web/src/features/sessions/utils/__tests__/share-session.test.ts) | web-dom | keep | REG | createSessionShareText：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### web/settings（7ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/settings/pages/settings-page/__tests__/use-settings-page.test.ts](../apps/web/src/features/settings/pages/settings-page/__tests__/use-settings-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useSettingsPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/settings/pages/settings-page/about-section/__tests__/use-about-section.test.ts](../apps/web/src/features/settings/pages/settings-page/about-section/__tests__/use-about-section.test.ts) | web-dom | review | HOOK | useAboutSection：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/settings/pages/settings-page/about-section/about-section.test.tsx](../apps/web/src/features/settings/pages/settings-page/about-section/about-section.test.tsx) | web-dom | consolidate | HOOK-MOCK | AboutSection：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/settings/pages/settings-page/linked-accounts/__tests__/use-linked-accounts.test.ts](../apps/web/src/features/settings/pages/settings-page/linked-accounts/__tests__/use-linked-accounts.test.ts) | web-dom | review | HOOK | useLinkedAccounts：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/settings/pages/settings-page/linked-accounts/linked-accounts.test.tsx](../apps/web/src/features/settings/pages/settings-page/linked-accounts/linked-accounts.test.tsx) | web-dom | review | PATH | LinkedAccounts：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/settings/pages/settings-page/theme-setting/__tests__/use-theme-setting.test.ts](../apps/web/src/features/settings/pages/settings-page/theme-setting/__tests__/use-theme-setting.test.ts) | web-dom | review | HOOK | THEME_OPTIONS：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/settings/pages/settings-page/theme-setting/theme-setting.test.tsx](../apps/web/src/features/settings/pages/settings-page/theme-setting/theme-setting.test.tsx) | web-dom | review | PATH | ThemeSetting：シナリオ・実体境界・他層との重複を確認 |

### web/shared（70ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/__tests__/authenticated-shell.test.tsx](../apps/web/src/__tests__/authenticated-shell.test.tsx) | web-dom | consolidate | HOOK-MOCK | AuthenticatedShell：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/__tests__/games-route.test.tsx](../apps/web/src/__tests__/games-route.test.tsx) | web-dom | review | PATH | GamesRoute：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/__tests__/home-route.test.tsx](../apps/web/src/__tests__/home-route.test.tsx) | web-dom | consolidate | HOOK-MOCK | HomeRoute dispatch：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/__tests__/login-route.test.tsx](../apps/web/src/__tests__/login-route.test.tsx) | web-dom | review | PATH | LoginRoute：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/__tests__/mobile-nav.test.tsx](../apps/web/src/__tests__/mobile-nav.test.tsx) | web-dom | consolidate | HOOK-MOCK, QUERY | MobileNav - Normal Mode (no active session)：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/__tests__/session-events-routes.test.tsx](../apps/web/src/__tests__/session-events-routes.test.tsx) | web-dom | review | PATH | session event route wrappers：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/__tests__/settings-route.test.tsx](../apps/web/src/__tests__/settings-route.test.tsx) | web-dom | review | PATH | SettingsComponent：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/__tests__/single-session-guard.test.tsx](../apps/web/src/__tests__/single-session-guard.test.tsx) | web-dom | consolidate | HOOK-MOCK, QUERY | Single-session guard — no active session：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/__tests__/statistics-raw-search.test.tsx](../apps/web/src/__tests__/statistics-raw-search.test.tsx) | web-dom | review | PATH | statistics route: validateSearch bakes defaults into location.search：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/__tests__/statistics-route.test.tsx](../apps/web/src/__tests__/statistics-route.test.tsx) | web-dom | review | PATH | StatisticsRoute：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/__tests__/tournament-lifecycle.test.tsx](../apps/web/src/__tests__/tournament-lifecycle.test.tsx) | web-dom | replace | A, HOOK-MOCK, QUERY | ActiveSessionPage — no active session：再開ケースは初期empty mock。既存の画面契約を保全し実ライフサイクルを補う |
| [apps/web/src/shared/components/app-navigation/app-navigation.test.tsx](../apps/web/src/shared/components/app-navigation/app-navigation.test.tsx) | web-dom | review | PATH | app navigation current-page semantics：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/auth-form-shell/auth-form-shell.test.tsx](../apps/web/src/shared/components/auth-form-shell/auth-form-shell.test.tsx) | web-dom | review | PATH | AuthFormShell：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/authenticated-shell/__tests__/use-authenticated-shell.test.ts](../apps/web/src/shared/components/authenticated-shell/__tests__/use-authenticated-shell.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useAuthenticatedShell：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/authenticated-shell/mobile-nav/__tests__/use-mobile-nav.test.ts](../apps/web/src/shared/components/authenticated-shell/mobile-nav/__tests__/use-mobile-nav.test.ts) | web-dom | review | HOOK-MOCK, HOOK, QUERY | useMobileNav：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/authenticated-shell/mobile-nav/mobile-nav.test.tsx](../apps/web/src/shared/components/authenticated-shell/mobile-nav/mobile-nav.test.tsx) | web-dom | consolidate | HOOK-MOCK | MobileNav：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/shared/components/authenticated-shell/online-status-bar/__tests__/use-online-status-bar.test.ts](../apps/web/src/shared/components/authenticated-shell/online-status-bar/__tests__/use-online-status-bar.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useOnlineStatusBar：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/authenticated-shell/sidebar-nav/mode-toggle/mode-toggle.test.tsx](../apps/web/src/shared/components/authenticated-shell/sidebar-nav/mode-toggle/mode-toggle.test.tsx) | web-dom | review | PATH | ModeToggle：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/authenticated-shell/sidebar-nav/sidebar-nav.test.tsx](../apps/web/src/shared/components/authenticated-shell/sidebar-nav/sidebar-nav.test.tsx) | web-dom | review | PATH | SidebarNav：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/authenticated-shell/sidebar-nav/user-menu/__tests__/use-user-menu.test.ts](../apps/web/src/shared/components/authenticated-shell/sidebar-nav/user-menu/__tests__/use-user-menu.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useUserMenu：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/authenticated-shell/sidebar-nav/user-menu/user-menu.test.tsx](../apps/web/src/shared/components/authenticated-shell/sidebar-nav/user-menu/user-menu.test.tsx) | web-dom | consolidate | HOOK-MOCK | UserMenu：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/shared/components/chip-purchases-editor/__tests__/chip-purchases-editor.test.tsx](../apps/web/src/shared/components/chip-purchases-editor/__tests__/chip-purchases-editor.test.tsx) | web-dom | review | PATH | ChipPurchasesEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/filter-chip-bar/__tests__/filter-chip.test.tsx](../apps/web/src/shared/components/filter-chip-bar/__tests__/filter-chip.test.tsx) | web-dom | review | PATH | FilterChip：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/filter-chip-bar/__tests__/filter-date-range.test.tsx](../apps/web/src/shared/components/filter-chip-bar/__tests__/filter-date-range.test.tsx) | web-dom | review | PATH | FilterDateRange：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/filter-presets/__tests__/filter-presets-sheet.test.tsx](../apps/web/src/shared/components/filter-presets/__tests__/filter-presets-sheet.test.tsx) | web-dom | consolidate | HOOK-MOCK | FilterPresetsSheet：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/shared/components/filter-presets/__tests__/use-filter-presets-sheet.test.ts](../apps/web/src/shared/components/filter-presets/__tests__/use-filter-presets-sheet.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useFilterPresetsSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/filter-presets/delete-preset-dialog/delete-preset-dialog.test.tsx](../apps/web/src/shared/components/filter-presets/delete-preset-dialog/delete-preset-dialog.test.tsx) | web-dom | review | PATH | DeletePresetDialog：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/form-sheet/form-sheet.test.tsx](../apps/web/src/shared/components/form-sheet/form-sheet.test.tsx) | web-dom | review | A | FormSheet：保存可否・Cancel操作は維持。dismissible props／装飾assertを操作で補完できるか確認 |
| [apps/web/src/shared/components/management/entity-list-item/__tests__/use-entity-list-item.test.ts](../apps/web/src/shared/components/management/entity-list-item/__tests__/use-entity-list-item.test.ts) | web-dom | review | HOOK | useEntityListItem：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/management/tag-manager/__tests__/use-tag-manager.test.ts](../apps/web/src/shared/components/management/tag-manager/__tests__/use-tag-manager.test.ts) | web-dom | review | HOOK | useTagManager：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/management/tag-name-form/__tests__/use-tag-name-form.test.ts](../apps/web/src/shared/components/management/tag-name-form/__tests__/use-tag-name-form.test.ts) | web-dom | review | HOOK | useTagNameForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/mix-form-sheet/__tests__/use-mix-form-sheet.test.ts](../apps/web/src/shared/components/mix-form-sheet/__tests__/use-mix-form-sheet.test.ts) | web-dom | review | HOOK, QUERY | useMixFormSheet：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/mix-games-editor/__tests__/mix-games-editor.test.tsx](../apps/web/src/shared/components/mix-games-editor/__tests__/mix-games-editor.test.tsx) | web-dom | review | PATH | MixGamesEditor — group heading：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/mix-games-editor/__tests__/use-mix-games-editor.test.ts](../apps/web/src/shared/components/mix-games-editor/__tests__/use-mix-games-editor.test.ts) | web-dom | review | HOOK | useMixGamesEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/ui/field/__tests__/field.test.tsx](../apps/web/src/shared/components/ui/field/__tests__/field.test.tsx) | web-dom | review | DOM | Field：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/ui/input-group/__tests__/input-group.test.tsx](../apps/web/src/shared/components/ui/input-group/__tests__/input-group.test.tsx) | web-dom | review | DOM | InputGroup：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/ui/rich-text-content/__tests__/rich-text-content.test.tsx](../apps/web/src/shared/components/ui/rich-text-content/__tests__/rich-text-content.test.tsx) | web-dom | review | PATH | RichTextContent：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/ui/rich-text-editor/__tests__/rich-text-editor.test.tsx](../apps/web/src/shared/components/ui/rich-text-editor/__tests__/rich-text-editor.test.tsx) | web-dom | review | PATH | RichTextEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/ui/rich-text-editor/__tests__/use-rich-text-editor.test.ts](../apps/web/src/shared/components/ui/rich-text-editor/__tests__/use-rich-text-editor.test.ts) | web-dom | review | HOOK | useRichTextEditor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/ui/tabs/tabs.test.tsx](../apps/web/src/shared/components/ui/tabs/tabs.test.tsx) | web-dom | consolidate | A | Tabs：CSS変数の個数別assertを集約し選択・キーボード操作の契約を評価 |
| [apps/web/src/shared/components/ui/tag-input/tag-input.test.tsx](../apps/web/src/shared/components/ui/tag-input/tag-input.test.tsx) | web-dom | review | PATH | TagInput：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/ui/tag-picker-base/__tests__/use-tag-picker-base.test.ts](../apps/web/src/shared/components/ui/tag-picker-base/__tests__/use-tag-picker-base.test.ts) | web-dom | review | HOOK | useTagPickerBase：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/variant-select/__tests__/use-variant-select.test.ts](../apps/web/src/shared/components/variant-select/__tests__/use-variant-select.test.ts) | web-dom | review | HOOK, QUERY | useVariantSelect：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/components/variant-select/__tests__/variant-select.test.tsx](../apps/web/src/shared/components/variant-select/__tests__/variant-select.test.tsx) | web-dom | review | QUERY | VariantSelect — combobox keyboard and ARIA：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-default-filter-preset.test.ts](../apps/web/src/shared/hooks/__tests__/use-default-filter-preset.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useDefaultFilterPreset：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts](../apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts) | web-dom | review | HOOK | useElapsedTime：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-filter-presets.test.ts](../apps/web/src/shared/hooks/__tests__/use-filter-presets.test.ts) | web-dom | review | HOOK, QUERY | useFilterPresets：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-game-groups.test.ts](../apps/web/src/shared/hooks/__tests__/use-game-groups.test.ts) | web-dom | review | HOOK, QUERY | useGameGroups：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-geolocation.test.ts](../apps/web/src/shared/hooks/__tests__/use-geolocation.test.ts) | web-dom | review | HOOK | useGeolocation：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-media-query.test.ts](../apps/web/src/shared/hooks/__tests__/use-media-query.test.ts) | web-dom | review | HOOK | useMediaQuery：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-mix-master-editing.test.ts](../apps/web/src/shared/hooks/__tests__/use-mix-master-editing.test.ts) | web-dom | review | HOOK | useMixMasterEditing — mixRowFor：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-mobile-nav-popover.test.ts](../apps/web/src/shared/hooks/__tests__/use-mobile-nav-popover.test.ts) | web-dom | review | HOOK | useMobileNavPopover：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-online-status.test.ts](../apps/web/src/shared/hooks/__tests__/use-online-status.test.ts) | web-dom | review | HOOK | useOnlineStatus：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-pwa-update.test.ts](../apps/web/src/shared/hooks/__tests__/use-pwa-update.test.ts) | web-dom | review | HOOK | usePwaUpdate：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-set-password-form.test.ts](../apps/web/src/shared/hooks/__tests__/use-set-password-form.test.ts) | web-dom | review | HOOK | useSetPasswordForm：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-sign-out.test.ts](../apps/web/src/shared/hooks/__tests__/use-sign-out.test.ts) | web-dom | review | HOOK | useSignOut：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-variant-labels.test.ts](../apps/web/src/shared/hooks/__tests__/use-variant-labels.test.ts) | web-dom | review | HOOK, QUERY | useVariantLabels：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/hooks/__tests__/use-variant-scope.test.ts](../apps/web/src/shared/hooks/__tests__/use-variant-scope.test.ts) | web-dom | review | HOOK | scopeOf：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/shared/lib/__tests__/form-fields.test.ts](../apps/web/src/shared/lib/__tests__/form-fields.test.ts) | web-node | keep | PATH | requiredNumericString：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/shared/lib/__tests__/mix-games.test.ts](../apps/web/src/shared/lib/__tests__/mix-games.test.ts) | web-node | keep | PATH | addVariant：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/shared/lib/__tests__/period-filter.test.ts](../apps/web/src/shared/lib/__tests__/period-filter.test.ts) | web-node | keep | PATH | PERIODS / PERIOD_LABEL：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/shared/lib/__tests__/pwa-manifest.test.ts](../apps/web/src/shared/lib/__tests__/pwa-manifest.test.ts) | web-node | keep | REG | pwaManifest：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/utils/__tests__/check-rules-path.test.ts](../apps/web/src/utils/__tests__/check-rules-path.test.ts) | web-node | keep | PATH | normalizeRulePath：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/utils/__tests__/format-elapsed-time.test.ts](../apps/web/src/utils/__tests__/format-elapsed-time.test.ts) | web-node | keep | PATH | formatElapsedTime：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/utils/__tests__/format-number.test.ts](../apps/web/src/utils/__tests__/format-number.test.ts) | web-node | consolidate | A, REG | formatCompactNumber：同一入出力の重複を削減。非有限値の仕様を先に確認 |
| [apps/web/src/utils/__tests__/format-profit-loss.test.ts](../apps/web/src/utils/__tests__/format-profit-loss.test.ts) | web-node | keep | PATH | formatProfitLoss：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/utils/__tests__/optimistic-update.test.ts](../apps/web/src/utils/__tests__/optimistic-update.test.ts) | web-node | keep | QUERY | optimistic-update helpers：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/utils/__tests__/query-persistence.test.ts](../apps/web/src/utils/__tests__/query-persistence.test.ts) | web-node | keep | A | shouldPersistQuery：成功queryのみ保存する判定を維持。実IndexedDB隔離の代替ではない |
| [apps/web/src/utils/__tests__/table-size-colors.test.ts](../apps/web/src/utils/__tests__/table-size-colors.test.ts) | web-node | keep | PATH | TABLE_SIZE_COLORS：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/utils/__tests__/vite-plugin-github-releases.test.ts](../apps/web/src/utils/__tests__/vite-plugin-github-releases.test.ts) | web-node | keep | PATH | githubReleasesPlugin：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### web/statistics（15ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/statistics/components/stats-filter-bar/__tests__/use-stats-filter-bar.test.ts](../apps/web/src/features/statistics/components/stats-filter-bar/__tests__/use-stats-filter-bar.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useStatsFilterBar：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/hooks/__tests__/use-stats-filters.test.ts](../apps/web/src/features/statistics/hooks/__tests__/use-stats-filters.test.ts) | web-dom | review | HOOK | useStatsFilters：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/__tests__/stats-query-error.test.tsx](../apps/web/src/features/statistics/pages/statistics-page/__tests__/stats-query-error.test.tsx) | web-dom | review | PATH | StatsQueryError：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/__tests__/use-statistics-page.test.ts](../apps/web/src/features/statistics/pages/statistics-page/__tests__/use-statistics-page.test.ts) | web-dom | review | HOOK-MOCK, HOOK | useStatisticsPage：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/breakdown-section/__tests__/use-breakdown-section.test.ts](../apps/web/src/features/statistics/pages/statistics-page/breakdown-section/__tests__/use-breakdown-section.test.ts) | web-dom | review | HOOK, QUERY | useBreakdownSection：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/breakdown-section/breakdown-table/__tests__/breakdown-table.test.tsx](../apps/web/src/features/statistics/pages/statistics-page/breakdown-section/breakdown-table/__tests__/breakdown-table.test.tsx) | web-dom | review | PATH | BreakdownTable：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/cash-game-stats/__tests__/use-cash-game-stats.test.ts](../apps/web/src/features/statistics/pages/statistics-page/cash-game-stats/__tests__/use-cash-game-stats.test.ts) | web-dom | review | HOOK, QUERY | useCashGameStats：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/kpi-cards/__tests__/use-kpi-cards.test.ts](../apps/web/src/features/statistics/pages/statistics-page/kpi-cards/__tests__/use-kpi-cards.test.ts) | web-dom | review | HOOK, QUERY | useKpiCards：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/aligned-domains.test.ts](../apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/aligned-domains.test.ts) | web-dom | review | PATH | computeAlignedDomain：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/labels.test.ts](../apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/labels.test.ts) | web-dom | review | PATH | formatPnlAxisValue：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/use-pnl-graph.test.ts](../apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/use-pnl-graph.test.ts) | web-dom | review | HOOK, QUERY, REG | usePnlGraph：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/pages/statistics-page/tournament-stats/__tests__/use-tournament-stats.test.ts](../apps/web/src/features/statistics/pages/statistics-page/tournament-stats/__tests__/use-tournament-stats.test.ts) | web-dom | review | HOOK, QUERY | useTournamentStats：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/statistics/utils/__tests__/aggregate-pnl-points.test.ts](../apps/web/src/features/statistics/utils/__tests__/aggregate-pnl-points.test.ts) | web-node | keep | REG | aggregatePnlPoints：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/statistics/utils/__tests__/format-stats.test.ts](../apps/web/src/features/statistics/utils/__tests__/format-stats.test.ts) | web-node | keep | PATH | formatMinutes：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/statistics/utils/__tests__/stats-filters.test.ts](../apps/web/src/features/statistics/utils/__tests__/stats-filters.test.ts) | web-node | keep | PATH | parseStatsSearch：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

### web/update-notes（5ファイル）

| ファイル | Project | 初期分類 | 根拠 | 対象名と次の判断 |
|---|---|---|---|---|
| [apps/web/src/features/update-notes/components/update-notes-sheet/__tests__/use-update-notes-sheet.test.tsx](../apps/web/src/features/update-notes/components/update-notes-sheet/__tests__/use-update-notes-sheet.test.tsx) | web-dom | consolidate | HOOK-MOCK | UpdateNotesProvider auto-open：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/update-notes/components/update-notes-sheet/update-notes-sheet.test.tsx](../apps/web/src/features/update-notes/components/update-notes-sheet/update-notes-sheet.test.tsx) | web-dom | consolidate | HOOK-MOCK | UpdateNotesSheet：hook mockの配線assertを実操作へ集約する候補 |
| [apps/web/src/features/update-notes/hooks/__tests__/use-update-notes-viewed.test.ts](../apps/web/src/features/update-notes/hooks/__tests__/use-update-notes-viewed.test.ts) | web-dom | review | HOOK, QUERY | useUpdateNotesViewed：シナリオ・実体境界・他層との重複を確認 |
| [apps/web/src/features/update-notes/utils/__tests__/parse-release-body.test.ts](../apps/web/src/features/update-notes/utils/__tests__/parse-release-body.test.ts) | web-node | keep | PATH | parseReleaseBody：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |
| [apps/web/src/features/update-notes/utils/__tests__/should-auto-open-update-notes.test.ts](../apps/web/src/features/update-notes/utils/__tests__/should-auto-open-update-notes.test.ts) | web-node | keep | PATH | shouldAutoOpenUpdateNotes：純粋ロジック／入力契約を暫定維持。境界・重複は精査 |

## 移行結果の記録

処置が確定したファイルから、以下の形式で追記する。基準一覧の行は履歴として残し、削除したファイルのリンクが解決しなくなった場合は基準HEADで参照する。新設テストは代替先として記録し、全機能からの逆引きにも対応させる。

| 基準ファイル／契約 | 確定した処置 | 代替先または不要になった理由 | 実行・検出力の確認 | 残る作業 |
|---|---|---|---|---|

初期分類の作成時点では移行結果は未記入。全407ファイルの処置確定、未テスト領域の評価、runnerの検出確認、CIの全対象実行が終わるまで、全面リファクタリング完了とは扱わない。
