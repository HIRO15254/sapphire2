# MCP サーバー

> **[English version here](mcp.md)**

sapphire2 はリモート [MCP](https://modelcontextprotocol.io/)（Model Context Protocol）サーバーを公開しており、AI エージェント（claude.ai のコネクタ、Claude Desktop、Claude Code、その他 MCP 対応クライアント）からポーカー統計の参照やルーム・ゲームマスタの管理ができます。

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

1. クライアントが `POST /api/auth/mcp/register`（動的クライアント登録 — 事前共有シークレット不要）。
2. クライアントがブラウザで `GET /api/auth/mcp/authorize?...` を開く。
3. 未ログインの場合、better-auth がリクエストを保存して web アプリの `/login` へリダイレクト。サインイン後、アプリが authorize エンドポイントへブラウザを戻す。
4. Worker が同意画面（アプリ名＋スコープ）を表示。**Approve** で `/api/auth/oauth2/consent` に送信され、認可コード付きでクライアントへリダイレクト。
5. クライアントが `POST /api/auth/mcp/token` でコードを交換（PKCE 検証）し、`Authorization: Bearer <アクセストークン>` で `/mcp` を呼ぶ。

ディスカバリ文書は RFC 8414 / RFC 9728 に従いルート直下で配信されます:

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource`（`/.well-known/oauth-protected-resource/mcp` にも併設）

未認証の `/mcp` リクエストには `401` と `WWW-Authenticate: Bearer resource_metadata="…"` が返り、クライアントはここからディスカバリを開始できます。

## ツール

ツール群は **tRPC `appRouter` の射影**です: 各ツールの入力スキーマは API が検証に使う Zod スキーマそのもの（union 入力の分岐ごとのツールはその分岐のスキーマ）で、レスポンスは HTTP API と同じ JSON です。規約もバックエンドに従います — **時刻は unix 秒**、entry ツールの **date-only 値は `YYYY-MM-DD` 文字列**（統計ツールは引き続き UTC midnight の秒）、**金額はその資産の最小単位の整数**。

B06 の切り替えで旧完了セッション・ライブセッション API と対応する MCP ツールは削除されました。完了した entry の記録・編集は `entry_*` ツールで行います。ライブ記録（`live.*`・`playEvent.*`・`tablePlayer.*`）はコックピット画面のもので、意図的に公開していません。プレイの進行に合わせて時刻を記録し、再試行した呼び出しはイベントを重複して追加するためです。複数 Day の操作 — Day の終了（`live.endPlay`）、次の Day やリエントリーの開始（`live.startNextPlay`）とその取り消し（`live.undoEndPlay`・`live.undoStartNextPlay`）— も同じで、開始を再試行すると Day がもう一つ増えます。

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

`player_list` はユーザー自身の self（Hero）プレイヤーと一時プレイヤーを除外します。`player.getSelf` は公開していません。

マスタの更新は destructive として注釈されています。**削除は公開していません。** 代わりにルーム、リングゲーム、トーナメント、ゲームマスタのアーカイブ/復元ツールを利用できます。ゲームマスタの一覧は既定でアーカイブ済みを除外し、`includeArchived` で含めます。

`ring_game_create` の `rule` は、任意の `game` を `{variantId}`・`{gameMixId}`・`{lineupId}` のいずれかで指定します。有効な variant / mix の ID は `game_variant_list` / `game_mix_list` で取得できます。`ring_game_list_by_room` が返す `lineupId` を再利用すると、アーカイブ済みの選択を含め保存時の構成を維持できます。アーカイブ済みマスタの新規選択はできません。作成時に game を省略すると builtin NLH が使われます。mix の variant はゲームグループごとにまとめられ、グループの順序は最初に現れた順です。`stakes` を指定する場合、構成の各グループに対応する要素を順番に一つずつ送り、それぞれ `gameGroupId` と任意の blind / ante を指定します。省略した stakes は絶対位置ではなくグループ ID と同じ構造内の出現順で引き継がれます。

`ring_game_list_by_room` は各マスタの `currentRuleId`、`lineupId` と `stakes` を含む `ruleVersion`、ID をキーとする `lineups` を返します。`ring_game_update` は指定された `rule` のフィールドを現在のルールにマージし、変更時は不変の新しい版を作り、内容が同じなら既存の版を再利用します。API の `ringGame.restoreRule` は画面専用の Undo であり MCP には公開されません。`ringGame.delete` も destructive なため除外されます。参照中のマスタは代わりにアーカイブしてください。

`tournament_update_with_levels`・`game_mix_update` は子リストを**丸ごと置き換える**ので、先に現在の内容を読んでから全件を送ってください。トーナメントの `rule` は不変の版です。`game` は `{ variantId }`・`{ gameMixId }`・`{ lineupId }` のいずれか、各レベルの `stakes` はそのゲームのグループごとに lineup の順で 1 件ずつ（`anteType` は none / all / bb）、`prices` は `{ kind: entry | reentry | addon, assetId, amount, fee, chips, label? }` で、レベルは最大 100 件、価格は最大 20 件です。内容が同じ保存では版を作らず、変更があれば新しい版を作って古い版を残します。過去の版への復元（`tournament.restoreRule`）はトーナメント画面だけで行います。

ゲームグループはブラインドのラベルと並んで `blind1Required`〜`blind3Required` を持ちます。組み込みの Limit と Stud は Small Bet と Big Bet が必須（Stud の Bring-in は任意）、Big Bet は SB と BB が必須で 3 番目の欄はありません。`game_group_create` ではすべて false が既定で、必須にできるのはラベルのある欄だけです。新しく書くリングゲーム・トーナメントのルール版（引き継いだ stakes を含む）は、必須の欄をすべて埋め、ラベルのない欄を空にする必要があります（`BAD_REQUEST`）。ante は対象外で、変更のない版の再利用は検査しません。`game_group_update` は、保存済みの stake にその欄の値が残っている間はラベルを消せません（`CONFLICT`）。

`hand_list` は 1 つの play session のハンドを `handNo` の大きい順に 1 ページ 1〜50 件（既定 20 件）返し、`{ items, nextCursor }` を返します。次のページは `nextCursor` を `cursor` に渡します。cursor は取得したときの `playSessionId` でだけ使えます。play session のハンド数はハンドの件数、現在のボタンは最大の `handNo` のハンドの `buttonSeat` です。ハンドカウンターの書き込み（`hand.add`・`hand.undoLast`）と `hand.delete` は公開していません。

`entry_list` はユーザーの entry を `playedOn` の新しい順に 1 ページ 1〜100 件（既定 20 件）返し、任意で `kind`・`status`・`roomId`・`assetId`・両端を含む `dateFrom`/`dateTo`（`YYYY-MM-DD`）で絞り込めます。`nextCursor` は取得したときと同じ絞り込みでだけ使えます。各 entry は日（`playSessions`）、すべての金額明細（`lines`。数量は資産の最小単位の符号付き整数）、資産ごとの `totals`、基準通貨での `valuation` と `missingRates`、`ruleDrift` 付きのルール版、タグを持ちます。`entry_create_cash` と `entry_create_tournament` は `entry.create` の `kind` 別の分岐です。`playedOn` は必須で、最初の日の `localDate` と一致させます。`playSessions` を省略するとトップレベルの `payments` で 1 日分を記録します。支払いは `{ role, assetId, quantity, effect, priceId? }` で、数量は正の整数、符号は role で決まります。entry は `ringGameId` / `tournamentId` でマスタを紐付けるか、独自の `rule` を記録します。`entry_update` は指定したフィールドだけを変え、`tagIds`・`playSessions`・`payments` は**丸ごと置き換え**ます。`id` を送った日はハンドごと残り、送らなかった日はハンドごと削除されます。ライブの entry で変えられるのは `roomId`・`assetId`・`title`・`memo`・`tagIds` だけです。紐付けたマスタとルールは `entry_update` では変えられず、`entry.delete` は公開していません。1 つの entry は最大 100 日、支払い 1000 件、タグ 100 件です。`entry_tag_list` / `entry_tag_create` で `tagIds` に使うタグを扱います。タグの名前変更と削除はタグ画面で行います。

`asset_list` は通貨とアイテムを `balance` 付きで返します。`balance` はその資産の real な台帳明細の符号付き合計（最小単位の整数。アイテムでは保有数）で、プレイ中の entry の buy-in も含みます。アーカイブ済みの資産は `includeArchived` を指定したときだけ、アクティブなものと合わせて返します。`asset_rate_list` はレートの履歴を、`effectiveAt` を指定するとベース/クォートの向きごとにその時点で有効な最新のレートを返します。`user_setting_get` は換算の基準通貨とタイムゾーン（`null` は Asia/Tokyo）を返します。どちらかや過去のレートを変えると、過去の換算値も変わります。資産・レート・設定の書き込みは公開していません。財布の台帳（`ledger.*`: 資産ごとの履歴、入出金、両替）とその分類（`ledgerCategory.*`）も公開していません。

ここに無い手続きは意図的な除外です（取り消し不能な削除、非冪等なお気に入りトグル、財布の台帳、AI 抽出など）— 理由は `packages/mcp/src/tools/registry.ts` に記載され、結合テストで強制されます。

認可は API 自身のものです: すべての呼び出しはユーザーセッション付きの `appRouter.createCaller` を通るため、`protectedProcedure` と所有権チェックが web アプリと完全に同じ形で適用されます。

## 運用メモ

- **同意は常に強制されます。** Worker はすべての authorize リクエストを better-auth に渡す前に `prompt=consent` へ書き換えます — これが無いと better-auth の mcp プラグインは動的登録された任意のクライアントに、ユーザーの操作ゼロで code を発行してしまいます。
- `/mcp` に**新しい環境変数や Worker シークレットは不要**です — OAuth プロバイダの URL は `BETTER_AUTH_URL` と `CORS_ORIGIN` から導出されます。
- **クライアントは名前なしで登録してくることがあります。** RFC 7591 で `client_name` は任意であり、Claude のコネクタは送ってきません。Worker は better-auth が行を書く前に空の名前を補うため、`NOT NULL` 制約で登録が失敗することはなく、同意画面にはリダイレクト先ホストとともに *Unknown application* と表示されます。
- OIDC テーブル（`oauth_application` / `oauth_access_token` / `oauth_consent`）はマイグレーション `0050` で追加されます。全 statement が `IF NOT EXISTS` なので途中失敗しても再適用できます（`.claude/rules/db-migrations.md` 参照）。
- アクセストークンの有効期限は 1 時間、リフレッシュトークンは 7 日（better-auth の既定値）。クライアントは自動でリフレッシュします。
