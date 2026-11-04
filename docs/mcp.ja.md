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

ツール群は **tRPC `appRouter` の射影**です: 各ツールの入力スキーマは API が検証に使う Zod スキーマそのもので、レスポンスは HTTP API と同じ JSON です。規約もバックエンドに従います — **日付は unix 秒**（date-only 値は UTC midnight）、**金額はその通貨の表示単位の整数**。

B06 の切り替えで旧完了セッション・ライブセッション API と対応する MCP ツールは削除されます。最終版の entry/live API が導入されるまではセッションの記録・編集は利用できません。以下の統計・マスタ系ツールは引き続き利用できます。

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
| `session_tag_list` | `sessionTag.list` | 参照 |
| `session_tag_create` | `sessionTag.create` | 記録 |
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

マスタの更新は destructive として注釈されています。**削除は公開していません。** 代わりにルーム、リングゲーム、トーナメント、ゲームマスタのアーカイブ/復元ツールを利用できます。ゲームマスタの一覧は既定でアーカイブ済みを除外し、`includeArchived` で含めます。

`tournament_update_with_levels`・`game_mix_update` は子リストを**丸ごと置き換える**ので、先に現在の内容を読んでから全件を送ってください。`mixGames` はリングゲーム系ツールが受け付けます — 名前付き mix は完全一致で再現する必要があり、mix が設定されている間は `blind1`〜`blind3` / `ante` / `anteType` が常に `null` になるため、これらのフラットなフィールドに送った値は破棄されます。

`hand_list` は 1 つの play session のハンドを `handNo` の大きい順に 1 ページ 1〜50 件（既定 20 件）返し、`{ items, nextCursor }` を返します。次のページは `nextCursor` を `cursor` に渡します。cursor は取得したときの `playSessionId` でだけ使えます。play session のハンド数はハンドの件数、現在のボタンは最大の `handNo` のハンドの `buttonSeat` です。ハンドカウンターの書き込み（`hand.add`・`hand.undoLast`）と `hand.delete` は公開していません。

`asset_list` は通貨とアイテムを `balance` 付きで返します。`balance` はその資産の real な台帳明細の符号付き合計（最小単位の整数。アイテムでは保有数）で、プレイ中の entry の buy-in も含みます。アーカイブ済みの資産は `includeArchived` を指定したときだけ、アクティブなものと合わせて返します。`asset_rate_list` はレートの履歴を、`effectiveAt` を指定するとベース/クォートの向きごとにその時点で有効な最新のレートを返します。`user_setting_get` は換算の基準通貨とタイムゾーン（`null` は Asia/Tokyo）を返します。どちらかや過去のレートを変えると、過去の換算値も変わります。資産・レート・設定の書き込みは公開していません。財布の台帳（`ledger.*`: 資産ごとの履歴、入出金、両替）とその分類（`ledgerCategory.*`）も公開していません。

ここに無い手続きは意図的な除外です（取り消し不能な削除、非冪等なお気に入りトグル、財布の台帳、AI 抽出など）— 理由は `packages/mcp/src/tools/registry.ts` に記載され、結合テストで強制されます。

認可は API 自身のものです: すべての呼び出しはユーザーセッション付きの `appRouter.createCaller` を通るため、`protectedProcedure` と所有権チェックが web アプリと完全に同じ形で適用されます。

## 運用メモ

- **同意は常に強制されます。** Worker はすべての authorize リクエストを better-auth に渡す前に `prompt=consent` へ書き換えます — これが無いと better-auth の mcp プラグインは動的登録された任意のクライアントに、ユーザーの操作ゼロで code を発行してしまいます。
- `/mcp` に**新しい環境変数や Worker シークレットは不要**です — OAuth プロバイダの URL は `BETTER_AUTH_URL` と `CORS_ORIGIN` から導出されます。
- **クライアントは名前なしで登録してくることがあります。** RFC 7591 で `client_name` は任意であり、Claude のコネクタは送ってきません。Worker は better-auth が行を書く前に空の名前を補うため、`NOT NULL` 制約で登録が失敗することはなく、同意画面にはリダイレクト先ホストとともに *Unknown application* と表示されます。
- OIDC テーブル（`oauth_application` / `oauth_access_token` / `oauth_consent`）はマイグレーション `0050` で追加されます。全 statement が `IF NOT EXISTS` なので途中失敗しても再適用できます（`.claude/rules/db-migrations.md` 参照）。
- アクセストークンの有効期限は 1 時間、リフレッシュトークンは 7 日（better-auth の既定値）。クライアントは自動でリフレッシュします。
