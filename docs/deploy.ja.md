# デプロイガイド

> **[English version](deploy.md)**

## 1. 概要

このリポジトリは Cloudflare Workers + D1 を前提とした構成です。

- **API サーバー**: Cloudflare Workers（Hono）
- **フロントエンド**: Cloudflare Pages（Vite SPA）
- **データベース**: Cloudflare D1（Drizzle ORM 経由の SQLite）

Worker は MCP エンドポイント（`/mcp`）と OAuth ディスカバリルート（`/.well-known/oauth-authorization-server`、`/.well-known/oauth-protected-resource`）も配信します。これらに**追加の環境変数やシークレットは不要**です — OAuth プロバイダの URL は `BETTER_AUTH_URL` と `CORS_ORIGIN` から導出されます。[mcp.ja.md](mcp.ja.md) を参照してください。

### デプロイ構成

| 環境 | トリガー | 内容 |
|------|---------|------|
| **ローカル** | `bun run dev` | `wrangler dev`（Workers ローカルシミュレーション） |
| **プレビュー** | PR 作成・同期・再オープン | PR ごとに独立した Worker と D1、共有 Pages プロジェクトの PR ブランチへデプロイ |
| **dev** | `dev` への push または workflow dispatch | Worker と Pages の URL は固定。D1 はデプロイごとに再作成してシード |
| **本番** | GitHub Release 公開または workflow dispatch | CI 通過後に Worker + Pages をデプロイ |

## 2. 前提条件

- [Cloudflare](https://dash.cloudflare.com/sign-up) アカウントと Workers Paid が必要。D1 の入力上限は Paid の Worker 1回の呼び出しあたり 1,000 クエリという制限から決めています。
- GitHub リポジトリの管理者権限（Secrets 設定に必要）
- [Bun](https://bun.sh/) がローカルにインストール済み
- [Node.js](https://nodejs.org/) 22.16.0 以上がローカルにインストール済み（Cloudflare Wrangler CLI と Vitest の実行用。パッケージマネージャーは引き続き Bun）

> ローカル開発用 D1 は Wrangler が作成します。プレビューと dev の DB は workflow が Cloudflare API で作成し、本番は `apps/server/wrangler.toml` に設定済みの DB を使用します。

## 3. ローカル開発

### 3.1 環境変数の設定

サーバーと Web の環境変数テンプレートをコピーします。

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/web/.env.example apps/web/.env
```

`apps/server/.dev.vars` をサーバー側の設定に合わせて編集:

```
OPENAI_API_KEY=your-openai-api-key
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

`OPENAI_API_KEY` と `GOOGLE_MAPS_API_KEY` は、AI 抽出または Google Places 検索を使う場合だけ必要です。

`apps/web/.env` は Vite クライアントを設定します。既定の `VITE_SERVER_URL` はローカル API の `http://localhost:8787` を指します。

`BETTER_AUTH_URL` と `CORS_ORIGIN` は認証情報・パス・クエリ・フラグメントを含まない HTTP(S) origin にします。末尾のスラッシュは指定でき、正規化されます。

### 3.2 マイグレーション実行

```bash
bun run db:migrate:local
```

### 3.3 開発サーバー起動

```bash
bun run dev
```

- API: `http://localhost:8787`（Wrangler は Node.js で実行）
- Web: `http://localhost:3001`（Vite）

## 4. Cloudflare セットアップ

### 4.1 API トークン作成

1. [API トークン画面](https://dash.cloudflare.com/profile/api-tokens) → 「Create Token」
2. 「Custom token」を選択し、以下の権限を付与:
   - **Account** > **Cloudflare Pages** > **Edit**
   - **Account** > **Workers Scripts** > **Edit**
   - **Account** > **D1** > **Edit**

### 4.2 Account ID の確認

Cloudflare ダッシュボード →「Workers & Pages」概要ページ → 右サイドバー

### 4.3 Pages プロジェクト作成

```bash
bunx wrangler pages project create sapphire2-web --production-branch main
```

[Cloudflare Pages の Wrangler コマンド](https://developers.cloudflare.com/workers/wrangler/commands/pages/)も参照してください。

### 4.4 本番 D1 データベース作成

リモート D1 は `db:migrate:remote` では作成されません。本番データベースを一度だけ作成します。

```bash
bunx wrangler d1 create sapphire2-db
```

返された `database_id` を `apps/server/wrangler.toml` へ設定し、`binding = "DB"` と `database_name = "sapphire2-db"` を Worker 設定と一致させます。

プレビューと dev の workflow は環境専用 DB を Cloudflare API で作成します。これらに本番 ID を流用しないでください。

[Cloudflare D1 の Wrangler コマンド](https://developers.cloudflare.com/d1/wrangler-commands/)も参照してください。

## 5. OAuth プロバイダーセットアップ

### Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. 「APIs & Services」>「Credentials」に移動
4. 「OAuth 2.0 クライアント ID」を作成（Web アプリケーション タイプ）
5. 承認済みリダイレクト URI を追加:
   - ローカル: `http://localhost:8787/api/auth/callback/google`
   - 本番: `https://<your-worker>.workers.dev/api/auth/callback/google`

### Discord OAuth

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 新しいアプリケーションを作成
3. 「OAuth2」設定に移動
4. リダイレクトを追加:
   - ローカル: `http://localhost:8787/api/auth/callback/discord`
   - 本番: `https://<your-worker>.workers.dev/api/auth/callback/discord`

## 6. GitHub Secrets 設定

### リポジトリ変数（Variables）

**Settings > Secrets and variables > Actions > Variables タブ > New repository variable** から追加。

| 変数名 | 取得元 | 説明 |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Workers & Pages 概要ページ |

### リポジトリシークレット（Secrets）

**Settings > Secrets and variables > Actions > Secrets タブ > New repository secret** から追加。

#### 共通

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Workers/Pages/D1 編集権限付きトークン |
| `BETTER_AUTH_SECRET` | 自分で生成 | `openssl rand -base64 32` で32文字以上 |

#### OAuth（Google/Discord）

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth 2.0 クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | OAuth 2.0 クライアント シークレット |
| `DISCORD_CLIENT_ID` | Discord Developer Portal | OAuth2 アプリケーション クライアント ID |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal | OAuth2 アプリケーション クライアント シークレット |

#### 機能別 API（任意）

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | AI 抽出を有効化 |
| `GOOGLE_MAPS_API_KEY` | Google Cloud | Google Places 検索を有効化 |

#### プレビュー自動ログイン

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `PREVIEW_LOGIN_EMAIL` | 自分で作成 | プレビュー環境の自動ログイン用テストアカウントのメールアドレス |
| `PREVIEW_LOGIN_PASSWORD` | 自分で作成 | プレビュー環境の自動ログイン用テストアカウントのパスワード |

### 本番環境用

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `PRODUCTION_API_URL` | Cloudflare | 本番 Worker URL（例: `https://sapphire2-api.<subdomain>.workers.dev`） |
| `PRODUCTION_WEB_URL` | Cloudflare | 本番 Pages URL（例: `https://sapphire2-web.pages.dev`） |

> `PRODUCTION_API_URL` / `PRODUCTION_WEB_URL` は初回デプロイ後に実際の URL を確認して設定。カスタムドメインがあればそちらを指定。

### リリースの自動化（任意）

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `LINEAR_API_KEY` | Linear の個人 API キー | `release.yml` がリリースに含まれる issue を Done から Released に移すために使う。Sapphire2 チームの issue への書き込み権限が必要。未設定でもリリースは行われ、issue は Done のまま残る |

## 7. カスタマイズ

### Worker 名の変更

Worker 名は本番、dev、PR ごとのプレビューで個別に設定されています。改名時は次の場所を一貫して更新します。

- `apps/server/wrangler.toml` の本番 `name`
- `.github/workflows/dev-deploy.yml` の `WORKER_NAME`
- `.github/workflows/preview-deploy.yml` の `WORKER_NAME` 接頭辞
- `.github/workflows/preview-cleanup.yml` の `WORKER_PREFIX`

### Pages プロジェクト名の変更

Pages のデプロイまたはクリーンアップを行う全 workflow を更新します。

- `.github/workflows/preview-deploy.yml` の `PAGES_PROJECT`
- `.github/workflows/preview-cleanup.yml` の `PROJECT_NAME`
- `.github/workflows/dev-deploy.yml` の `PAGES_PROJECT`
- `.github/workflows/production-deploy.yml` の `--project-name` 引数

### 本番デプロイ

`release.yml` が tag と GitHub Release を公開し、その tag を指定して `production-deploy.yml` を明示的に dispatch します。既定の `GITHUB_TOKEN` で作成した Release は別 workflow を再帰起動しないためです。`production-deploy.yml` は外部の `release: published` と手動 `workflow_dispatch` にも対応します。処理順は CI → マイグレーション → [データ監査](design/data-audits.md) → Worker デプロイ → Pages デプロイです。監査は `bun scripts/audit-data-model.ts --remote --database sapphire2-db` を実行し、手動で再実行することもできます。監査失敗時は両方のデプロイを停止します。

続いて `release.yml` は、[`scripts/release-linear-issues.ts`](../scripts/release-linear-issues.ts) でリリースに含まれる Linear の issue を Done から Released に移します。リリースの PR は、マージコミットが前回のタグから今回のリリースのマージまでの間にあるマージ済み PR です。issue は、その PR に Linear が紐付けたものです。移すのは Done の issue だけです。この step は失敗してもリリースを止めません。

`concurrency` 設定により直列実行。CI job は PR の CI と同じ再利用 workflow [`checks.yml`](../.github/workflows/checks.yml) を呼ぶため、dev と本番のデプロイは同一のゲートを通る。失敗時はデプロイをスキップ。

### プレビューと dev のデータベースシード

dev の D1 はデプロイごとに再作成し、プレビューの D1 は初回以降再利用します。新規 DB は本番 DB の最新適用済みマイグレーションまで適用し、本番のデータのみをエクスポートしてシードした後、残りのマイグレーションを適用します。ダンプの `d1_migrations` 行は除外します。既存プレビュー DB は再シードせずマイグレーションを適用します。その後 dev では `bun scripts/audit-data-model.ts --remote --database sapphire2-db-dev --config apps/server/wrangler.toml` を実行します。クエリ失敗または違反があれば job は失敗し、Worker デプロイを停止します。監査はデータを修正せずステータスと行数を報告します。ローカルとリモートでの使い方は[監査一覧](design/data-audits.md)を参照してください。

インポート時は派生行の重複を防ぐため `sqlite_master` から取得した trigger を一時削除します。終了時の trap は失敗時も trigger を復元し、復元失敗も job の失敗とします。SQLite は保存済み trigger 定義から `IF NOT EXISTS` を除去するため、復元ファイルは CREATE の前に DROP を付けます。外部キーはダンプ中だけ無効にし、別のインポートで有効化してから確認し、残りのマイグレーションを実行します。

プレビューは DB 名を完全一致で解決します。名前重複エラー 7502 は既存 DB と扱い、それ以外の ID のない作成応答は再解決して新規扱いにします。Web ビルドは Releases API の未認証レート制限を避けるため `GITHUB_TOKEN` をプラグインに渡します。

リリースノートは Claude action の structured output から取得し、空または不正な `release_notes` では公開しません。dispatch は `actions: write` とリリース tag を使用し、本番にリリース済みのツリーをデプロイします。

復元によるマイグレーション復旧が必要なリリースでは、データ入力を停止し、前のデプロイ可能な tag を保持して、マイグレーション直前に `bunx wrangler d1 time-travel info sapphire2-db -c apps/server/wrangler.toml` で D1 Time Travel の bookmark を記録します。マイグレーションとデプロイの間は書き込みを行いません。マイグレーションまたは監査が失敗した場合は、部分適用されたチェーンの再試行や追加修正をせず、`bunx wrangler d1 time-travel restore sapphire2-db --bookmark=<bookmark> -c apps/server/wrangler.toml` で復元します。Worker が置き換わった場合は `gh workflow run production-deploy.yml --ref <previous tag>` で前の tag を再デプロイします。`dev` で修正とリハーサルを行ってから再試行します。復元すると bookmark 以降の書き込みは失われます。入力再開前にリリースを確認してください。適用する復旧方針は[マイグレーションルール](../.claude/rules/db-migrations.md)に従います。

## 8. 動作確認

### プレビュー

1. テストブランチを作成して PR を出す（新しい commit の push と PR の再オープンでも同じプレビュー環境を再デプロイ）
2. Actions タブで「Preview Deploy」を確認
3. PR コメントにプレビュー URL が投稿される
4. PR クローズで自動クリーンアップ

### 本番

1. GitHub Release を公開（`release/vX.Y.Z` PR を `main` にマージ）
2. Actions タブで「Production Deploy」を確認
3. Worker URL と Pages URL にアクセス

## 9. トラブルシューティング

### `CLOUDFLARE_API_TOKEN` 権限不足

```
Error: Authentication error
```

API トークンに Workers Scripts **Edit** + Cloudflare Pages **Edit** + D1 **Edit** 権限があるか確認。

### D1 マイグレーション失敗

```
Error: D1_ERROR
```

`apps/server/wrangler.toml` の `d1_databases` の設定を確認。


### Worker デプロイ失敗

```
Error: compatibility_date is too old
```

`apps/server/wrangler.toml` の `compatibility_date` を更新。

### Pages デプロイ失敗

```
Error: A project with this name does not exist
```

`bunx wrangler pages project create sapphire2-web --production-branch main` で事前にプロジェクト作成が必要。

## 10. アーキテクチャ

### プレビューデプロイ（PR 作成・同期・再オープン時）

```
PR open/synchronize
  |
  +-> D1 データベース作成 (pr-<番号>)
  |     |
  |     +-> マイグレーション実行
  |           |
  |           +-> Worker デプロイ (sapphire2-api-pr-<番号>)
  |                 |
  |                 +-> Pages デプロイ (pr-<番号> ブランチ)
  |                       |
  |                       +-> PR にプレビュー URL をコメント
```

### クリーンアップ（PR クローズ時）

```
PR close/merge
  |
  +-> Worker 削除 -> 孤児 Preview Worker 削除 -> Pages ブランチデプロイ削除 -> D1 データベース削除 -> PR コメント更新
```

### dev デプロイ（`dev` への push 時）

```
push to dev
  |
  +-> CI -> D1 再作成 -> 基礎マイグレーション -> シード -> 残りのマイグレーション -> 監査 -> Worker デプロイ (sapphire2-api-dev) -> Pages デプロイ (dev)
```

### 本番デプロイ（release PR マージ時または手動 dispatch）

```
release PR を main へマージ
  |
  +-> release.yml: tag + GitHub Release を作成
        |
        +-> tag を指定して production-deploy.yml を dispatch
        |     |
        |     +-> CI (型チェック, lint, テスト)
        |           |
        |           +-> マイグレーション -> 監査 -> Worker デプロイ -> Pages デプロイ
        |
        +-> リリースに含まれる Linear の issue を Done から Released に移す
```

### 技術スタック

```
                    ┌─────────────────┐
                    │  Cloudflare CDN │
                    └────────┬────────┘
                ┌────────────┴────────────┐
        ┌───────┴───────┐         ┌───────┴───────┐
        │   Pages       │         │   Workers     │
        │   (React SPA) │ ──API──>│   (Hono)      │
        └───────────────┘         └───────┬───────┘
                                          │
                                  ┌───────┴───────┐
                                  │   D1          │
                                  │   (SQLite)    │
                                  └───────────────┘
```
