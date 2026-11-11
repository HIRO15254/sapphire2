# MCP サーバー

> **[English version here](mcp.md)**

sapphire2 はリモート [MCP](https://modelcontextprotocol.io/)（Model Context Protocol）サーバーを公開しており、AI エージェント（claude.ai のコネクタ、Claude Desktop、Claude Code、その他 MCP 対応クライアント）からポーカー統計の参照、entry の記録、タグの作成、ルーム・ゲームマスタの管理ができます。

- **エンドポイント**: `https://<APIホスト>/mcp`（Streamable HTTP）
- **認証**: OAuth 2.1 + 動的クライアント登録（RFC 7591）、PKCE 必須
- **実装**: `packages/mcp`（`apps/server` の Worker がマウント）

## 接続方法

### claude.ai / Claude Desktop

カスタムコネクタを追加し、エンドポイント URL を貼り付けます:

```
https://<APIホスト>/mcp
```

クライアントは `/.well-known/oauth-protected-resource` から OAuth エンドポイントを発見し、自身を登録してブラウザでログイン・同意フローを開きます。sapphire2 アカウントでサインインして **Approve** を押せば接続完了です。

### Claude Code

```sh
claude mcp add --transport http sapphire2 https://<APIホスト>/mcp
```

初回利用時に同じ OAuth フローが実行されます（`/mcp` → authenticate）。

## OAuth フロー

1. クライアントが `POST /api/auth/oauth2/register`（動的クライアント登録 — 事前共有シークレット不要）。リダイレクト URI は HTTPS、ループバックの HTTP（`localhost`、`127.0.0.1`、`[::1]`）、またはアプリ独自スキームに限られます。
2. クライアントがブラウザで `GET /api/auth/oauth2/authorize?...` を開く。PKCE は `S256` のみ（`plain` は拒否）。
3. 未ログインの場合、authorize エンドポイントが web アプリの `/login` へリダイレクト。サインイン後、アプリが authorize エンドポイントへブラウザを戻す。
4. Worker が同意画面（アプリ名、リダイレクト先ホスト、実際のツール権限）を表示。**Approve** で `/api/auth/oauth2/consent` に送信され、認可コード付きでクライアントへリダイレクト。
5. クライアントが `POST /api/auth/oauth2/token` でコードを交換（PKCE 検証）し、`Authorization: Bearer <アクセストークン>` で `/mcp` を呼ぶ。アクセストークンの有効期間は 1 時間。`offline_access` スコープを要求するとリフレッシュトークン（有効期間 7 日）が発行され、リフレッシュのたびに新しいものへ置き換わります。古いリフレッシュトークンを再利用するとクライアントの接続が切れます。

MCP の接続は web アプリへのログイン状態に依存しません。

クライアントの接続を解除するには、web アプリの **Settings → MCP clients** で **Disconnect** を選びます。そのクライアントのアクセストークンとリフレッシュトークンはすぐに使えなくなり、再び使うには認可をやり直します。

ディスカバリ文書（RFC 8414 / RFC 9728）。認可サーバーの issuer は `https://<your-api-host>/api/auth` です:

- `GET /.well-known/oauth-authorization-server/api/auth`（`/.well-known/oauth-authorization-server` と `/api/auth/.well-known/oauth-authorization-server` にも併設）
- `GET /.well-known/oauth-protected-resource`（`/.well-known/oauth-protected-resource/mcp` にも併設）

未認証の `/mcp` リクエストには `401` と `WWW-Authenticate: Bearer resource_metadata="…"` が返り、クライアントはここからディスカバリを開始できます。

OAuth プロバイダの更新（better-auth 1.7）以前に作成した接続は一度使えなくなります。コネクタを削除して追加し直すか、Claude Code では `/mcp` → authenticate を再実行してください。

## ツール

ツール群は **tRPC `appRouter` の射影**です: 各ツールの入力スキーマは API が検証に使う Zod スキーマそのもの（union 入力の分岐ごとのツールはその分岐のスキーマ）で、レスポンスは HTTP API と同じ JSON です。時刻の入力は Unix 秒、出力は JSON の時刻です。**date-only 値は `YYYY-MM-DD` 文字列**です。entry の支払い、台帳の金額、トーナメントの価格は資産の最小単位の整数で、blind と stake は変換しない非負の数値です。

統計ツールは **確定済み（settled）の entry だけ** を集計し、モードを必ず 1 つ指定します: `assetId`（その資産の実ラインを換算せずに合計。他の資産も使った entry は `multiAssetEntryCount` / `otherAssetIds` で報告）、`valuation: "real" | "virtual"` と任意の `baseAssetId`（省略時はユーザー設定の基準資産。どちらも無ければ `PRECONDITION_FAILED`。レートの無いラインを持つ entry は除外され `excludedEntryCount` / `missingRates` で報告）、`normalized: true`（キャッシュは BB、トーナメントは BI で、合算しない）。`dateFrom` / `dateTo` は両端を含み entry の `playedOn` と比較します。`entryTagIds` / `tournamentTagIds` でタグ絞り込みができます。

絞り込みには `kind` と `roomId` も使え、各タグ種別内では指定したタグのいずれかに一致します。基準資産は `valuation` と併用する場合だけ指定でき、通貨である必要があります。複数モードの同時指定や逆順の日付は拒否され、`normalized: false` は省略と同じです。`stats_breakdown` はルーム、ステークス、種別、曜日、長さ、月、年、variant ごとに集計します。`stats_profit_loss_series` は累計ではなく entry ごとの増減を時系列で返し、単位は `asset`・`bb`・`bi`、coverage も返します。

`winRate` と `itmRate` は 0〜100 のパーセンテージです。`bbPerHour` と `bb100` は換算から除外された entry も含め、条件を満たす cash entry を使います。長さの `unknown` は開始・終了がそろう Day がない場合です。

完了した entry の記録・編集は `entry_*` ツールで行います。ライブ記録（`live.*`・`playEvent.*`・`tablePlayer.*`）は UI のコックピット向けで、意図的に公開していません。プレイの進行に合わせて時刻を記録し、再試行によりイベントが重複する場合があるためです。Day の終了、次の Day やリエントリーの開始、およびその取り消しも含みます。

| ツール | tRPC 手続き | 種別 |
|---|---|---|
| `stats_summary` | `stats.summary` | 参照 |
| `stats_breakdown` | `stats.breakdown` | 参照 |
| `stats_profit_loss_series` | `stats.profitLossSeries` | 参照 |
| `room_list` | `room.list` | 参照 |
| `asset_list` | `asset.list` | 参照 |
| `asset_rate_list` | `assetRate.list` | 参照 |
| `user_setting_get` | `userSetting.get` | 参照 |
| `player_list` | `player.list` | 参照 |
| `hand_list` | `hand.list` | 参照 |
| `hand_get_by_id` | `hand.getById` | 参照 |
| `entry_list` | `entry.list` | 参照 |
| `entry_get_by_id` | `entry.getById` | 参照 |
| `entry_create_cash` | `entry.create`（`kind: "cash"`） | 記録 |
| `entry_create_tournament` | `entry.create`（`kind: "tournament"`） | 記録 |
| `entry_update` | `entry.update` | 記録 |
| `entry_tag_list` | `entryTag.list` | 参照 |
| `entry_tag_create` | `entryTag.create` | 記録 |
| `tournament_tag_list` | `tournamentTag.list` | 参照 |
| `tournament_tag_create` | `tournamentTag.create` | 記録 |
| `hand_tag_list` | `handTag.list` | 参照 |
| `hand_tag_create` | `handTag.create` | 記録 |
| `player_tag_list` | `playerTag.list` | 参照 |
| `player_tag_create` | `playerTag.create` | 記録 |
| `ring_game_list_by_room` | `ringGame.listByRoom` | 参照 |
| `tournament_list_by_room` | `tournament.listByRoom` | 参照 |
| `room_get_by_id` | `room.getById` | 参照 |
| `room_create` | `room.create` | 記録 |
| `room_update` | `room.update` | 記録 |
| `room_archive` | `room.archive` | 記録 |
| `room_restore` | `room.restore` | 記録 |
| `ring_game_create` | `ringGame.create` | 記録 |
| `ring_game_update` | `ringGame.update` | 記録 |
| `ring_game_archive` | `ringGame.archive` | 記録 |
| `ring_game_restore` | `ringGame.restore` | 記録 |
| `tournament_get_by_id` | `tournament.getById` | 参照 |
| `tournament_create_with_levels` | `tournament.createWithLevels` | 記録 |
| `tournament_update_with_levels` | `tournament.updateWithLevels` | 記録 |
| `tournament_archive` | `tournament.archive` | 記録 |
| `tournament_restore` | `tournament.restore` | 記録 |
| `game_group_list` | `gameGroup.list` | 参照 |
| `game_group_create` | `gameGroup.create` | 記録 |
| `game_group_update` | `gameGroup.update` | 記録 |
| `game_group_archive` | `gameGroup.archive` | 記録 |
| `game_group_restore` | `gameGroup.restore` | 記録 |
| `game_variant_list` | `gameVariant.list` | 参照 |
| `game_variant_create` | `gameVariant.create` | 記録 |
| `game_variant_update` | `gameVariant.update` | 記録 |
| `game_variant_archive` | `gameVariant.archive` | 記録 |
| `game_variant_restore` | `gameVariant.restore` | 記録 |
| `game_mix_list` | `gameMix.list` | 参照 |
| `game_mix_create` | `gameMix.create` | 記録 |
| `game_mix_update` | `gameMix.update` | 記録 |
| `game_mix_archive` | `gameMix.archive` | 記録 |
| `game_mix_restore` | `gameMix.restore` | 記録 |

`player_list` はユーザー自身の self（Hero）プレイヤーと一時プレイヤーを除外します。任意の検索文字列は100文字以内で、ASCII の大文字小文字を区別しないリテラルな名前の部分一致です。任意の `tagIds` は重複しないプレイヤータグ ID を最大100件指定でき、いずれかに一致するプレイヤーを返します。`player.getSelf` は公開しておらず、相手のハンド履歴と VPIP/PFR（`player.hands`、`player.handStats`）もプレイヤー画面のものなので公開していません。

`stats_summary` と `stats_breakdown` は `handCount`（すべての詳細度のハンド数）、`bb100`、`handsPerHour` を返します。`bb100` は BB が分かりハンドが 1 件以上ある cash entry について、bb 単位の損益の合計 ÷ ハンド数の合計 × 100 で、entry ごとの率の平均ではありません。`handsPerHour` はハンドが 1 件以上あり開始と終了がそろう日だけを数えるので、ハンド数と時間は同じ日から取られます。対象がなければどちらも `null` です。

マスタの更新と `entry_update` は destructive として注釈されます。`entry_update` は Day の置き換えで新しい ID が生じ得るため non-idempotent です。**削除は公開していません。** 代わりにルーム、リングゲーム、トーナメント、ゲームマスタのアーカイブ/復元ツールを利用できます。それらの一覧と `asset_list` は既定でアーカイブ済みを除外し、`includeArchived` で含めます。

`ring_game_create` の `rule` は、任意の `game` を `{variantId}`・`{gameMixId}`・`{lineupId}` のいずれかで指定します。有効な variant / mix の ID は `game_variant_list` / `game_mix_list` で取得できます。`ring_game_list_by_room` が返す `lineupId` を再利用すると、アーカイブ済みの選択を含め保存時の構成を維持できます。アーカイブ済みマスタの新規選択はできません。作成時に game を省略すると builtin NLH が使われます。mix の variant はゲームグループごとにまとめられ、グループの順序は最初に現れた順です。`stakes` を指定する場合、構成の各グループに対応する要素を順番に一つずつ送り、それぞれ `gameGroupId` と任意の blind / ante を指定します。省略した stakes は絶対位置ではなくグループ ID と同じ構造内の出現順で引き継がれます。

作成時にはアクティブなルームが必要で、新たに選ぶデフォルト資産もアクティブである必要があります。`defaultAssetId` と `memo` は省略または null を指定でき、memo は50,000文字以内です。既定の NLH がアーカイブ済みの場合も選択に失敗します。最小・最大 buy-in は10^12以下の非負整数で、最小値は最大値以下でなければなりません。

`ring_game_list_by_room` は各マスタの `currentRuleId`、`lineupId` と `stakes` を含む `ruleVersion`、ID をキーとする `lineups` を返します。`ring_game_update` は指定された `rule` のフィールドを現在のルールにマージし、変更時は不変の新しい版を作り、内容が同じなら既存の版を再利用します。API の `ringGame.restoreRule` は画面専用の Undo であり MCP には公開されません。`ringGame.delete` も destructive なため除外されます。参照中のマスタは代わりにアーカイブしてください。

`tournament_update_with_levels`・`game_mix_update` は子リストを**丸ごと置き換える**ので、先に現在の内容を読んでから全件を送ってください。トーナメントの `rule` は不変の版です。`game` は `{ variantId }`・`{ gameMixId }`・`{ lineupId }` のいずれか、各レベルの `stakes` はそのゲームのグループごとに lineup の順で 1 件ずつ（`anteType` は none / all / bb）、`prices` は `{ kind: entry | reentry | addon, assetId, amount, fee, chips, label? }` で、レベルは最大 100 件、価格は最大 20 件です。内容が同じ保存では版を作らず、変更があれば新しい版を作って古い版を残します。過去の版への復元（`tournament.restoreRule`）はトーナメント画面だけで行います。

`tournament_create_with_levels` と `tournament_update_with_levels` はタグ名ではなく `tagIds` を受け取ります。更新時に `tagIds` を指定するとタグ一覧全体を置き換え、省略すると変更せず、`[]` で消去します。

ゲームグループはブラインドのラベルと並んで `blind1Required`〜`blind3Required` を持ちます。組み込みの Limit と Stud は Small Bet と Big Bet が必須（Stud の Bring-in は任意）、Big Bet は SB と BB が必須で 3 番目の欄はありません。`game_group_create` ではすべて false が既定で、必須にできるのはラベルのある欄だけです。新しく書くリングゲーム・トーナメントのルール版（引き継いだ stakes を含む）は、必須の欄をすべて埋め、ラベルのない欄を空にする必要があります（`BAD_REQUEST`）。ante は対象外で、変更のない版の再利用は検査しません。`game_group_update` は、保存済みの stake にその欄の値が残っている間はラベルを消せません（`CONFLICT`）。

ゲームグループは `fixedAnteType`（`none` / `all` / `bb`。stakes ごとに選ぶときは null）も持ちます。組み込みの Stud は `all` に固定されています。設定があるグループの stakes を送るときは `anteType` を省略すると固定の種別で保存されます。違う `anteType` は拒否され、`none` に固定したグループでは ante の金額も拒否されます（`BAD_REQUEST`）。引き継いだ stakes と変更のない版は保存済みの種別のままで、`game_group_update` で設定を変えても保存済みの stakes は書き換わりません。

`game_mix_create` は最大 12 グループにわたる重複のない variant ID を 2〜30 件必要とし、`game_mix_update` で `games` を指定した場合も同じ制限が適用されます。更新では既存のアーカイブ済み variant は維持できますが、新たに追加できません。`game_variant_update` で新たに選ぶグループはアクティブである必要があります。

`hand_list` は 1 つの play session のハンドを `handNo` の大きい順に 1 ページ 1〜50 件（既定 20 件）返し、`{ items, nextCursor }` を返します。次のページは `nextCursor` を `cursor` に渡します。cursor は取得したときの `playSessionId` でだけ使えます。play session のハンド数はすべての詳細度のハンドの件数、現在のボタンは最大の `handNo` のハンドの `buttonSeat` です。`detail` は `count`（ボード・席・ポット・レーキ・メモなし）、`summary`（ライブ中のメモ。Hero の 1 席・ボード・ポット・レーキ・メモを持ち、アクションは持たない）、`full`（全席とアクション。アクションは `hand_get_by_id` が返す）のいずれかです。summary の値はメモであり、統計には使いません。`isHero` は `playerId` がユーザー自身のプレイヤーである席を示します。ハンドカウンターの書き込み（`hand.add`・`hand.undoLast`）、詳細の書き込み `hand.update`、`hand.delete` は公開していません。

ハンドを削除するとハンド番号が詰められるため、削除前の cursor では削除後のページを一貫して取得できない場合があります。

`entry_list` は entry を `playedOn` の新しい順に 1 ページ 1〜100 件（既定 20 件）返し、`kind`・`status`・`roomId`・`assetId`・両端を含む `dateFrom`/`dateTo`（`YYYY-MM-DD`）で絞り込めます。`nextCursor` は取得時と同じ絞り込みでだけ使えます。各 entry は Day、符号付き金額明細、資産ごとの合計、基準資産への換算と不足レート、ルール版、`ruleDrift`、タグを持ちます。基準資産や必要なレートがない場合、換算値は null になり得ます。`entry_create_cash` と `entry_create_tournament` は最初の Day の `localDate` と一致する `playedOn` を必要とし、`playSessions` を省略するとトップレベルの支払いで 1 日分を記録します。支払いは `{ role, assetId, quantity, effect?, priceId? }` で、effect の既定値は real、数量は正で符号は role が決めます。マスタを紐付けた上で `rule` を上書き指定することもできます。新しい価格付き支払いには選択した現在のルールの価格 ID を使います。アーカイブ済み資産の支払いは既存の明細数まで維持できます。`entry_update` は指定されたフィールドだけを変え、`tagIds`・`playSessions`・`payments` は**丸ごと置き換え**ます。`id` を送った日はハンドごと残り、送らなかった日はハンドごと削除されます。ライブ entry で変えられるのは `roomId`・`assetId`・`title`・`memo`・`tagIds` だけです。ルール操作、ルール復元 Undo、`entry.delete` は公開していません。1 entry は最大 100 日、支払い 1000 件、タグ 100 件です。

`entry_tag_*`・`tournament_tag_*`・`hand_tag_*`・`player_tag_*` の list/create ツールで 4 種類のタグを扱います。タグの名前変更・削除・並べ替えはタグ画面で行います。

`asset_list` は通貨とアイテムを `balance` 付きで返します。`balance` はその資産の real な台帳明細の符号付き合計（最小単位の整数。アイテムでは保有数）で、プレイ中の entry の buy-in も含みます。アーカイブ済みの資産は `includeArchived` を指定したときだけ、アクティブなものと合わせて返します。`asset_rate_list` はレートの履歴を、`effectiveAt` を指定するとベース/クォートの向きごとにその時点で有効な最新のレートを返します。`user_setting_get` は換算の基準通貨とタイムゾーン（`null` は Asia/Tokyo）を返します。基準通貨や過去のレートを変えると過去の換算値も変わりますが、タイムゾーンを変えても記録済みの日付は変わりません。資産・レート・設定の書き込みは公開していません。財布の台帳（`ledger.*`: 資産ごとの履歴、入出金、両替）とその分類（`ledgerCategory.*`）も公開していません。

ここに無い手続きは意図的な除外です（取り消し不能な削除、非冪等なお気に入りトグル、財布の台帳、AI 抽出など）— 理由は `packages/mcp/src/tools/registry.ts` に記載され、結合テストで強制されます。

認可は API 自身のものです: すべての呼び出しはユーザーセッション付きの `appRouter.createCaller` を通るため、`protectedProcedure` と所有権チェックが web アプリと完全に同じ形で適用されます。

## 運用メモ

- **同意は常に強制されます。** Worker はすべての authorize リクエストを better-auth に渡す前に `prompt=consent` へ書き換えます — これが無いと better-auth の mcp プラグインは動的登録された任意のクライアントに、ユーザーの操作ゼロで code を発行してしまいます。
- `/mcp` に**新しい環境変数や Worker シークレットは不要**です — OAuth プロバイダの URL は `BETTER_AUTH_URL` と `CORS_ORIGIN` から導出されます。
- **クライアントは名前なしで登録してくることがあります。** RFC 7591 で `client_name` は任意であり、Claude のコネクタは送ってきません。Worker は better-auth が行を書く前に空の名前を補うため、`NOT NULL` 制約で登録が失敗することはなく、同意画面にはリダイレクト先ホストとともに *Unknown application* と表示されます。
- OAuth のアプリケーション、アクセストークン、同意の情報はデータベースに保存されます。
- アクセストークンの有効期限は 1 時間、リフレッシュトークンは 7 日（better-auth の既定値）。クライアントは自動でリフレッシュします。
