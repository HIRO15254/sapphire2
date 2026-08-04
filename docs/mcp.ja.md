# MCP サーバー

> **[English version here](mcp.md)**

sapphire2 はリモート [MCP](https://modelcontextprotocol.io/)（Model Context Protocol）サーバーを公開しており、AI エージェント（claude.ai のコネクタ、Claude Desktop、Claude Code、その他 MCP 対応クライアント）からポーカーセッションデータの参照・記録ができます。

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

| ツール | tRPC 手続き | 種別 |
|---|---|---|
| `session_list` | `session.list` | 参照 |
| `session_get_by_id` | `session.getById` | 参照 |
| `session_create_cash_game` | `session.create`（cash 枝） | 記録 |
| `session_create_tournament` | `session.create`（tournament 枝） | 記録 |
| `session_update` | `session.update` | 記録 |
| `stats_summary` | `stats.summary` | 参照 |
| `stats_breakdown` | `stats.breakdown` | 参照 |
| `stats_profit_loss_series` | `stats.profitLossSeries` | 参照 |
| `room_list` | `room.list` | 参照 |
| `currency_list` | `currency.list` | 参照 |
| `player_list` | `player.list` | 参照 |
| `session_tag_list` | `sessionTag.list` | 参照 |
| `session_tag_create` | `sessionTag.create` | 記録 |
| `ring_game_list_by_room` | `ringGame.listByRoom` | 参照 |
| `tournament_list_by_room` | `tournament.listByRoom` | 参照 |
| `room_get_by_id` | `room.getById` | 参照 |
| `room_create` | `room.create` | 記録 |
| `room_update` | `room.update` | 記録 |
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
| `game_variant_list` | `gameVariant.list` | 参照 |
| `game_variant_create` | `gameVariant.create` | 記録 |
| `game_variant_update` | `gameVariant.update` | 記録 |
| `game_mix_list` | `gameMix.list` | 参照 |
| `game_mix_create` | `gameMix.create` | 記録 |
| `game_mix_update` | `gameMix.update` | 記録 |

マスタ系のツールは既存セッションが参照している行を書き換えるため、`*_update` 系は destructive として注釈されています。**削除はどれも公開していません。** リングゲームとトーナメントにはアーカイブ/復元があるのでそちらを公開していますが、ルームとゲームマスタには存在しないので、誤って `room_create` / `game_variant_create` を叩くと Web UI からしか消せない行が残ります — 作成前に対応する list ツールで確認してください。

`tournament_update_with_levels` と `game_mix_update` は子リストを**丸ごと置き換える**ので、先に現在の内容を読んでから全件を送ってください。`mixGames` を使うリングゲームは `blind1`〜`blind3` / `ante` / `anteType` が常に `null` になり、これらのフラットなフィールドに送った値は破棄されます。

ここに無い手続きは意図的な除外です（ライブセッションの状態機械、取り消し不能な削除、非冪等なお気に入りトグル、バンクロール台帳の書き込み、AI 抽出など）— 理由は `packages/mcp/src/tools/registry.ts` に記載され、結合テストで強制されます。

認可は API 自身のものです: すべての呼び出しはユーザーセッション付きの `appRouter.createCaller` を通るため、`protectedProcedure` と所有権チェックが web アプリと完全に同じ形で適用されます。

## 運用メモ

- **同意は常に強制されます。** Worker はすべての authorize リクエストを better-auth に渡す前に `prompt=consent` へ書き換えます — これが無いと better-auth の mcp プラグインは動的登録された任意のクライアントに、ユーザーの操作ゼロで code を発行してしまいます。
- `/mcp` に**新しい環境変数や Worker シークレットは不要**です — OAuth プロバイダの URL は `BETTER_AUTH_URL` と `CORS_ORIGIN` から導出されます。
- OIDC テーブル（`oauth_application` / `oauth_access_token` / `oauth_consent`）はマイグレーション `0050` で追加されます。全 statement が `IF NOT EXISTS` なので途中失敗しても再適用できます（`.claude/rules/db-migrations.md` 参照）。
- アクセストークンの有効期限は 1 時間、リフレッシュトークンは 7 日（better-auth の既定値）。クライアントは自動でリフレッシュします。
