**Backend テストの再編・レビュー結果**

2026-09-05。基準 HEAD `37371fd8` の API 45、DB 32、MCP 6、Server 5、Env 2、計 90 ファイルについて、テストの対象・assertion・mock 境界を確認して処置を確定した。基準一覧は [testing-migration-inventory.ja.md](testing-migration-inventory.ja.md)。以下の削除・改名済みパスは基準 HEAD の名前で記す。

全ファイルを変更することを目標にせず、保護する契約を残して実行境界を修正した。API の procedure 存在・型・middleware 数の反復、currency / transaction / player の DB mock による SQL 動作の再現、DB の宣言を写した 20 ファイルを整理した。入力 schema、損益計算、データ移行、外部依存の障害処理、個別の既知回帰は保全している。

**新しい実 D1 の保護と参照先**

以下はすべて `packages/api/src/__integration__/` にある。`test-database.ts` が本番 migration 全ファイルを番号順に適用し（初回 51、最新 dev 統合後 52 ファイル）、`test-fixture.ts` が各ケースで独立した非永続 Miniflare D1 を作成・破棄する。開発用 D1 は参照せず、`cf: false` により起動時の外部 metadata 取得も行わない。caller の session は型付きの fixture であり、Cookie / OAuth 自体の検証は別の実 HTTP / E2E が担当する。

| 略号・ファイル | 実行して守る契約 |
|---|---|
| A: [authentication.test.ts](../packages/api/src/__integration__/authentication.test.ts) | 登録済み全 procedure を未認証 caller で実行して `UNAUTHORIZED` を確認。公開許容は healthCheck のみ。入力拒否や DB エラーは認証成功として扱わない |
| C: [currency.test.ts](../packages/api/src/__integration__/currency.test.ts) | 保存・再読込・部分更新・clear・favorite・削除、有効入力での未認証全拒否、他人 / 不存在 ID の同じ拒否と保存状態不変、実 JOIN の残高と他人の集計除外、使用中通貨の削除拒否 |
| T: [currency-transaction.test.ts](../packages/api/src/__integration__/currency-transaction.test.ts) | 未認証・入力 FK・更新対象の所有権、保存後の金額・UTC 日付・clear、他人の session/type 名を JOIN から除外、同日複数行の keyset pagination と他人 / 削除済み cursor |
| P: [player.test.ts](../packages/api/src/__integration__/player.test.ts) | 本人 CRUD、未認証・他人・不存在・foreign tag の拒否と無変更、タグ順序・clear・省略保持・検索・旧不正リンクの情報非開示、100 超の hydration と 34 件タグ置換、後半 INSERT 失敗時の親・旧リンク全体の rollback |
| L: [live-session.test.ts](../packages/api/src/__integration__/live-session.test.ts) | cash 開始→追加入金→完了→新 caller→再開、損益台帳の作成 / 削除。tournament の費用・賞金・bounty と完了後の再開拒否。cash / tournament 同時作成の 1 成功・1 CONFLICT、同時イベント追加の連続順序 |
| R: [relational-integrity.test.ts](../packages/api/src/__integration__/relational-integrity.test.ts) | 孤児 FK の挿入拒否、削除時の cascade / set null と記録済み snapshot 保全、アカウント削除時の本人関連行削除と他人保全、manual / live 制約、user email・OAuth client ID・access / refresh token の実重複拒否 |
| S: [schema-migrations.test.ts](../packages/api/src/__integration__/schema-migrations.test.ts) | Drizzle と適用済み SQL の全列・型・nullability・PK・FK / onDelete・index 列順の互換性。`.unique()`・table unique・explicit unique index を SQLite の暗黙 index も含めて全照合 |
| V: [schema-values.test.ts](../packages/api/src/__integration__/schema-values.test.ts) | JSON / false / 0 / 座標 / timestamp の実 Drizzle 往復、既定 variant 表示名の回帰、filter の本人・画面別名前 / default 制約。Session Result の実同時初期化と部分 unique の範囲 |

S は DB schema と migration の不一致を検出する集中チェックであり、同じ値を 20 ファイルに列挙する代わりになる。unique は index 名だけではなく列集合・順序まで照合する。OAuth の列単位 unique も対象にした。部分 unique の条件は V の filter / Session Result と R・L の unfinished live session で実挿入して保護する。game mix の複合 FK・位置 CHECK・unique・cascade は既存の migration-0049 の実 SQL 検証を保全した。

S はすべての default 式や CHECK 式の文字列一致を要求しない。利用者の動作に関係する既定値は C・P・V、データ変換と既知制約は migration テストが担う。列名・型を変更するたびに期待値を機械的に写し直す保守はなくした。

**API 45 ファイルの処置**

特記のないパスは `packages/api/src/__tests__/`。表の「認証 metadata を集約」は、そのファイルの存在確認・procedure 一覧・query/mutation 型・`expectProtected` だけのケースを削除し、A と既存 MCP coupling に移したことを指す。業務入力を実際に parse するケースや caller の既知回帰は削除していない。

| 基準ファイル | 処置 | 残す契約・代替先と理由 |
|---|---|---|
| ai-extract-sources.test.ts | 一部削除 | tuple の readonly を length だけで判定する重複を削除。対応 app ID と config の対応・必要な prompt を維持 |
| ai-extract-truncation.test.ts | 維持 | LLM 応答が途中終了する外部境界の障害を固定 fixture で再現。通常の D1 成功フローでは代替できない |
| ai-extract.test.ts | 部分集約 | 認証 metadata を A へ。画像入力・抽出結果の schema と金額境界を維持 |
| auth-signup-hook.test.ts | 維持 | signup 後の副作用が失敗しても登録が失敗しない障害契約。外部 callback の制御が目的 |
| blind-level.test.ts | 部分集約 | 認証 metadata を A へ。盲額・games・reorder の入力契約、別 tournament を巻き込まない bulk 条件の既知回帰を維持 |
| currency-transaction.test.ts | 実 D1 へ置換 | DB mock・procedure metadata を削除。schema のみ残し、所有権・UTC 日付・JOIN・cursor・保存・削除を T へ |
| currency.test.ts | 実 D1 へ置換 | DB mock・procedure metadata を削除。schema のみ残し、残高・favorite・clear・使用中削除拒否・本人隔離を C へ |
| db-batch-atomicity.test.ts | 改名・保証範囲修正 | `db-batch-composition.test.ts` に改名。多種類の親子・snapshot・台帳を同じ batch へ渡す構成と失敗伝播を維持。mock 内の「committed」配列と自己充足的な空配列 assertion を削除。実 rollback は P、永続ライフサイクルは L |
| db-errors.test.ts | 維持 | D1 / Drizzle の cause chain、unique 違反種別からドメインエラーへの変換。失敗を fixture で直接与える単体境界として必要 |
| duplicate-tag-ids.test.ts | 維持 | 複数公開入力の重複 tag ID 拒否という共通入力契約。各 CRUD で全組合せを繰り返さない |
| filter-preset.test.ts | 部分集約 | 認証 metadata を A へ。画面別 payload、重複名のエラー変換、default 切替・更新の分岐を維持。実 unique と JSON 往復は V が補完 |
| foreign-key-id-validation.test.ts | 維持 | 外部入力の空 FK ID と placement 整合性。TypeScript だけでは外部の不正入力を拒否できない |
| game-group.test.ts | 部分集約 | 認証 metadata を A へ。予約名・衝突・自己除外・使用中削除・seed 順序の契約を維持 |
| game-masters.test.ts | 維持 | 予約 namespace と組み込み優先の順序、衝突判定。純粋ロジックと制御した依存境界の検証 |
| game-mix.test.ts | 部分集約 | 認証 metadata と schema helper 自体の重複 sanity を削除。group 数、variant 所有権、正規化 membership の順序と既知回帰を維持 |
| game-variant.test.ts | 部分集約 | 認証 metadata を A へ。group 所有権・ラベル衝突・移動・削除時参照・組み込み並びの契約を維持 |
| live-cash-game-session.test.ts | 部分集約 | 認証 metadata を A へ。room / ringGame / currency 所有権、状態別 guard、同日 cursor・一括イベント取得の回帰を維持。実 create 競合・台帳・再開は L |
| live-cash-reopen.test.ts | 維持 | 再開が状態更新・台帳削除まで 1 batch に含む構成と、batch 失敗を握り潰さない回帰。実再開後の保存状態は L が確認 |
| live-session-pl.test.ts | 維持 | 座席・hero・損益・休憩時間のイベント再計算と明示的な金額期待値。多数の同値でない履歴があり、代表 E2E のみでは不足 |
| live-tournament-session.test.ts | 部分集約 | 認証 metadata を A へ。種別・入力・所有権・構造 snapshot・blind chunk・cursor / event batching の既知回帰を維持。実完了・再開拒否・競合は L |
| location.test.ts | 部分集約 | 認証 metadata を A へ。Google Maps URL の解析・許可範囲・短縮 URL redirect 拒否は外部通信制御が必要で維持 |
| ownership-error-uniformity.test.ts | 一部置換 | player 本体と入力 tag の mock 所有権ケースを P へ。playerTag / sessionTag / transactionType / room / filterPreset の存在を隠す同一エラー回帰は維持 |
| pagination.test.ts | 維持 | 純粋な overfetch→items / nextCursor 変換。空・ちょうど境界・超過・非破壊性は実 SQL の T と異なる責務 |
| password-compare.test.ts | 維持 | 一致・長さ違い・文字違いの比較契約。時間一定性そのものを計測した証拠とは扱わない |
| player-tag.test.ts | 部分集約 | 認証 metadata を A へ。名前・色・ID の外部入力検証を維持 |
| player.test.ts | 実 D1 へ置換 | DB mock・procedure metadata を削除。入力 schema のみ残し、全 CRUD・タグ・検索・認可・chunk / rollback を P へ |
| ring-game.test.ts | 部分集約 | 認証 metadata を A へ。nullable room / currency・所有者設定・mixGames と variant の書込不変条件を維持。DB 型・default・削除は R・V |
| room.test.ts | 部分集約 | 認証 metadata を A へ。外部入力の名前・nullable 項目・座標の境界を維持 |
| seed-game-data-chunking.test.ts | 維持 | 通常の組み込みデータより大きい入力 fixture による membership batch の境界。seed 固有の列幅を保護し、DB rollback の証拠にはしない |
| seed-game-data-unresolvable-variant.test.ts | 維持 | 意図的に不整合な seed constants を注入して空 INSERT と部分解決を検証。実の整合した constants では到達しない設定障害 |
| seed-game-data.test.ts | 維持 | 既存ユーザー・欠損・再実行・正規化 membership・自分の seed の維持。migration のデータ変換とは別のアプリ側初期化契約 |
| session-event.test.ts | 部分集約 | 認証 metadata を A へ。入力・イベント対象・purchase_chips の親所有権を維持。実同時順序は L |
| session-result-type.test.ts | 一部置換 | mock が一意性を実装する同時作成ケースを V の実 D1 へ。既存行の再利用、作成後の返値、upsert 後にも行がない障害は維持 |
| session-table-player.test.ts | 部分集約 | 認証 metadata を A へ。座席入力・join / leave 時刻と順序・foreign tag・temporary player・hydrate の既知回帰を維持 |
| session-tag.test.ts | 部分集約 | 認証 metadata を A へ。名前・ID の公開入力を維持 |
| session.test.ts | 部分集約 | 認証 metadata を A へ。損益・EV・chunk helper・種別別 schema・live 連動編集禁止・FK / tag guard・snapshot・フィルターの既知回帰を維持 |
| stats.test.ts | 部分集約 | 認証 metadata を A へ。集計の金額・正規化単位・stakes・期間・variant 変換と所有権の回帰を維持。単純な CRUD の置換対象とは異なる計算責務 |
| tournament-chip-purchase.test.ts | 部分集約 | 認証 metadata を A へ。費用・chips・count・reorder の入力と親 tournament の範囲制御を維持 |
| tournament.test.ts | 部分集約 | 認証 metadata を A へ。levels / games / tag 付き作成更新・通貨所有権・hydration・金額境界を維持 |
| transaction-type-behavior.test.ts | 維持 | 予約名を DB 接触前に拒否、既存 seed の再利用、初期化競合のエラー経路。実 unique・同時収束は V |
| transaction-type.test.ts | 部分集約 | 認証 metadata を A へ。予約名と外部入力の検証を維持 |
| update-note-view.test.ts | 部分集約 | 認証 metadata を A へ。閲覧記録の upsert と並行呼出し時の既知回帰、version 入力を維持。実 unique 構成は S |
| ../ai/__tests__/models.test.ts | 維持 | 出力 token 予算が thinking で枯渇しない最小値。モデル ID の一致は既に型 / check:rules が担っており重複を追加しない |
| ../utils/__tests__/seat-position.test.ts | 維持 | 座席番号と table size の整合性、未知サイズ時の扱いという独立入力契約 |
| ../utils/__tests__/session-event-time.test.ts | 維持 | 分単位の時刻処理、追加可能時刻、同時刻の順序と SQL order 契約。L は実 concurrent append を補完 |

`test-utils.ts` から `expectProtected` / `expectType` を削除した。前者は middleware 数しか見ず、認証 middleware の欠落を検出できなかった。schema 抽出は外部入力テストに必要なため残す。残存 DB mock は個別分岐・構文・依存エラーの補助であり、JOIN・認可・rollback を実行したと報告しない。

**DB 32 ファイルの処置**

パスは `packages/db/src/__tests__/`。削除した 20 ファイルの列・PK・FK・index・unique 宣言はすべて S の実適用 schema 照合へ移した。「unique なし」という契約も、PK を除いた実 unique key の集合が一致することで検証される。

| 基準ファイル | 処置 | 代替先・維持理由 |
|---|---|---|
| currency.test.ts | 削除・置換 | S の列 / FK / unique に加え、C・T の実金額 / 日付 / default、V の Session Result 部分 unique、R の cascade。宣言コピーを削除 |
| filter-preset-schema.test.ts | 削除・置換 | S の構造と全 unique、V の JSON / default・同一名・本人画面別 default の実拒否 / 許容 |
| game-group-schema.test.ts | 削除・置換 | S が user FK と builtinKey / label unique を実照合。既定の組み込み値は game-variants、seed / label 動作は API の各テストを維持 |
| game-mix-schema.test.ts | 削除・置換 | S が owner 複合参照のための unique も実照合。migration-0049 が旧 JSON→junction のデータ保全を実 SQL で保護 |
| game-mix-variant-schema.test.ts | 削除・置換 | S の複合 PK / FK・位置 unique、migration-0049 の負位置 CHECK・他人参照拒否・cascade / 再実行を維持 |
| game-variant-schema.test.ts | 削除・置換 | S の group FK restrict と owner / builtinKey / label unique、migration-0049 の複合 FK とデータ整合を維持 |
| oauth-schema.test.ts | 削除・置換 | S の列単位 `.unique()` と暗黙 index も含む全照合、R の実 client/access/refresh 重複拒否、migration-0050 の FK・cascade・途中再開を維持 |
| player-schema.test.ts | 削除・置換 | S の構造・junction PK / FK、P の実順序・保存・clear・cascade・rollback |
| ring-game.test.ts | 削除・置換 | S の構造と unique なし、V の variant / JSON / timestamp 往復、R の親削除と snapshot 保全 |
| room.test.ts | 削除・置換 | S の構造と unique なし、V の座標 / timestamp、R の cascade / set null |
| session-blind-level-schema.test.ts | 削除・置換 | S の構造と unique なし、V の games JSON・false、L / migration の session 保全 |
| session-cash-detail-schema.test.ts | 削除・置換 | S の PK / FK・列構造、V の既定 variant / JSON、R の frozen 値保全、L の金額・状態 |
| session-chip-purchase-result-schema.test.ts | 削除・置換 | S の複合 PK / FK・型 / nullability。回数と費用の計算は既存 live-session-pl・tournament payload を維持 |
| session-chip-purchase-schema.test.ts | 削除・置換 | S の PK / FK・型 / index。snapshot / clear-and-reseed の構成は API batch-composition、計算は live-session-pl を維持 |
| session-event.test.ts | 削除・置換 | S の session / sortOrder unique、L の実同時追加と保存、R の親削除 cascade。イベント payload は別の runtime schema テストを維持 |
| session-schema.test.ts | 削除・置換 | S の構造、R の manual CHECK・unfinished live unique / cascade / set null、L の実競合・ライフサイクル、既存 migration 群 |
| session-tag-schema.test.ts | 削除・置換 | S の複合 PK / cascade FK。入力と tag 組合せは API session / session-tag / duplicate-tag-ids を維持 |
| session-tournament-detail-schema.test.ts | 削除・置換 | S の PK / FK・型、V の既定 variant / timer timestamp、L の完了と再開拒否 |
| tournament.test.ts | 削除・置換 | S の tournament / blind / chip の構造、V の既定 variant / JSON / false。費用・level の入力契約は API を維持 |
| update-note-view.test.ts | 削除・置換 | S が user / version unique・FK を実照合。API update-note-view が記録 upsert と入力を維持 |
| filter-preset-payload-schema.test.ts | 維持 | ユーザーが保存する JSON の screen 別 runtime schema・正規化。DB 列宣言の写しではない |
| game-schemas.test.ts | 維持 | mix / level のゲーム構成と数値の外部入力契約。画面・API の共有 schema を一か所で検証 |
| game-variants.test.ts | 維持 | default label と seed の参照整合、組み込みゲームの組合せと表示順、表示用変換。カタログ自体が製品データ |
| session-event-types.test.ts | 維持 | イベント種別・payload の識別と入力拒否。DB 宣言では検証できない runtime 契約 |
| tournament-session-end-payload.test.ts | 維持 | 完了時の buy-in / prize / placement の組合せと数値入力。損益に直結する契約 |
| migration-0041.test.ts | 維持・Bun 実行 | 全履歴適用と session 正規化の既存データ保全。DB を作り直す統合 fixture では代替しない |
| migration-0044.test.ts | 維持・Bun 実行 | unfinished live 制約の導入、完了後の枠解放と再開制限、既存重複を黙って書き換えず移行失敗する契約 |
| migration-0045.test.ts | 維持・Bun 実行 | 重複 Session Result の決定的な統合・ledger 参照の付替え、通常名保全、本人別の部分 unique を実 SQL で検証 |
| migration-0046.test.ts | 維持・Bun 実行 | 既存の安定した表示順を保つ event の採番、session 別 unique と atomic max-plus-one 追加を実 SQL で検証 |
| migration-0049.test.ts | 維持・Bun 実行 | game mix の正規化と owner 複合 FK / CHECK / unique、途中失敗からの再実行と既存データ保全 |
| migration-0050.test.ts | 維持・Bun 実行 | OAuth 全テーブル・unique・FK / cascade、二重適用・途中再開・既存 token 保全 |
| preview-seed-restore.test.ts | 維持・Bun 実行 | preview データの退避復元、trigger と参照整合。新規 D1 初期化だけでは守れない復旧手順 |

**MCP・Server・Env 13 ファイルの処置**

MCP の catalogue 一覧・schema 同一性・readOnly / destructive hint は、API の内部配線の反復とは異なり、公開 tool と同意画面の契約なので維持した。実 token 取得→MCP 実行・HTTP 所有権・期限切れ / 無効 token の接続は別の [E2E 構成](testing-environment.ja.md) が補完する。

| 基準ファイル | 処置 | 維持理由・代替先 |
|---|---|---|
| packages/mcp/src/__tests__/protocol.test.ts | 維持 | SDK による initialize / schema 公開 / JSON-RPC error / notification と union schema の変換契約 |
| packages/mcp/src/auth/__tests__/mcp-session.test.ts | 維持 | 有効期限・user なし / 不一致・削除済み user の純粋変換境界。実 HTTP の成功例だけでは各 guard を網羅しない |
| packages/mcp/src/auth/__tests__/consent-html.test.ts | 維持 | 未信頼の client 名・redirect host・JSON script の escape、実権限の表示と許諾先。XSS の回帰を保全 |
| packages/mcp/src/lib/__tests__/errors.test.ts | 維持 | ID を漏らさないエラー、Zod issues、重複 tRPC instance、ログと unexpected error の秘匿 |
| packages/mcp/src/tools/__tests__/call.test.ts | 維持 | 全 tool の routing、入力無変換、Date / 空値の serialization、失敗の in-band 変換。caller 依存を制御する adapter 単体境界 |
| packages/mcp/src/tools/__tests__/coupling.test.ts | 部分集約 | 偽の expectProtected 依存を除去して A へ。公開 healthCheck の tool 除外、catalogue / router / schema / hints / 同意文面の結合契約を維持 |
| apps/server/src/__tests__/auth-options.test.ts | 維持 | env→認証 provider の URL・credentials 構成と signup seed callback。環境別構成の境界 |
| apps/server/src/__tests__/consent-gate.test.ts | 維持 | client 指定 prompt の上書き、authorize 別名、set-password 順序、二重 dispatch 禁止。実 Hono routing と認証 adapter 境界 |
| apps/server/src/__tests__/mcp-route.test.ts | 維持 | 401 challenge・MCP preflight・credentialed CORS・同意画面の cache / framing 制約。HTTP ヘッダー自体が契約 |
| apps/server/src/__tests__/oauth-consent.test.ts | 維持 | authorize path・prompt・host・query の純粋解析。危険 / 不正 URL の扱いを高速に検証 |
| apps/server/src/__tests__/oauth-discovery.test.ts | 維持 | well-known と resource suffix の endpoint・CORS・公開 metadata の仕様 |
| packages/env/src/__tests__/server.test.ts | 維持 | 必須 binding・secret 長・URL の runtime validation。型では外部 env の正当性を保証できない |
| packages/env/src/__tests__/web.test.ts | 維持 | VITE prefix・URL・空文字正規化・任意 preview fields。実行時の環境入力契約 |

**検出力・実装の修正・実行結果**

実 D1 に移したことで、既存 DB mock が通していた次の 2 不具合を再現した。API の procedure 入力・MCP 公開面は変更していない。

- transaction の第 2 ページで raw SQL に Date オブジェクトを直接 bind し、D1 が拒否していた。T が失敗した後、列の timestamp encoder を `sql.param` に渡して修正した。同日 ID の順序とページ境界を確認している。
- player の tag のみ更新 / ID のみの有効な更新で、Drizzle が空 `.set({})` を拒否していた。P が失敗した後、親項目の UPDATE を必要な場合にだけ組み立て、tag 置換と no-op を保存状態で確認した。

P の rollback ケースでは、34 個目の tag INSERT を trigger で拒否し、元の親・memo・タグ順がすべて残ることを検証した。検出力確認として `runBatch` を一時的に逐次実行へ変更すると、INSERT の失敗だけでなく、親の更新が残る保存状態の不一致でテストが失敗した。故障は `finally` で戻し、製品の batch helper には変更を残していない。

初回の新統合テストは 8 ファイル / 35 実行ケースで、最新 dev 統合時に passkey の実保存を 1 ケース追加した。A は 1 ケース内で全登録 procedure を検証するため、procedure 数を別テスト数として加算しない。既存 API / MCP の対象プロジェクト、DB の残存 Vitest 対象、Bun migration 7 ファイル / 55 ケースを実行した。Vitest の DB プロジェクトで表示される 55 skip は Bun 専用分であり、別 runner で全件成功したものと区別する。最終的な全領域の件数・型 / lint・CI の状態はルートの検証結果を参照する。

ローカル D1 は本番分散環境や全 API の全 SQL 経路を再現するものではない。残存の mock を使う回帰テストについても、上記の維持理由は構成・入力・局所分岐の保護であり、実 DB 動作を全面的に検証済みという意味ではない。今後変更する機能で JOIN・所有権・複数表書込が関係する場合は、この D1 fixture に該当シナリオを追加・移植する。全 API を同じ数の CRUD テストで機械的に埋める運用には戻さない。

**最新 dev の追加テストと競合解消の追補**

`origin/dev` の `8d3dbdc2` を統合した。基準 407 ファイルのうち backend 90 ファイルという上記一覧を履歴として維持し、後から追加された次の 4 ファイルを別枠で判断した。

| dev で追加されたファイル | 処置 | 契約・代替先 |
|---|---|---|
| packages/db/src/__tests__/passkey-schema.test.ts | 実 D1 へ置換 | 12 件の宣言確認を S と V へ。0051 を含む実 migration、schema barrel の plugin 名からの実 INSERT / SELECT、camelCase→SQL の往復、0 / false / null・createdAt default、credential ID のアカウント横断 unique、本人削除 cascade と他人保全を確認。実 WebAuthn の署名検証を行ったとは扱わない |
| apps/server/src/__tests__/login-continuation.test.ts | 維持 | sign-in / sign-up / callback / token / consent 経路で不要な continuation cookie だけを除去し、body・session cookie・set-password の例外を保つ。実 Hono→認証 adapter の入力境界を検証する |
| apps/server/src/__tests__/oauth-register.test.ts | 維持 | DCR path と省略 / null client_name の補完、既存値・不正 JSON・他 endpoint の無変更、body 書換え時の Content-Length 除去。Request を実際に読戻す独立した変換契約 |
| apps/server/src/__tests__/register-gate.test.ts | 維持 | DCR の補完が実 Hono routing に接続され、continuation cookie 除去と共存し、token body を変えず二重 dispatch もしない。全認証成功の証拠ではなく adapter 接続の回帰として維持 |

API の競合 6 ファイルと、削除 / 変更競合となった DB currency・room は、基準 `37371fd8` と dev の実行 token 列が同一で、upstream 差分はコメントだけだった。比較後に当方のテスト集約と削除を維持し、最新の comments.md に合わせて説明コメントを除去した。machine directive は保持し、理由と検証の限界は本記録・テスト環境の文書に残した。新しい passkey schema・0051 migration・OAuth 実装は upstream の内容を保持している。
