# デプロイガイド

> **[English version](deploy.md)**

## 1. 概要

このリポジトリは Cloudflare Workers + D1 を前提とした構成です。

- **API サーバー**: Cloudflare Workers（Hono）
- **フロントエンド**: Cloudflare Pages（Vite SPA）
- **データベース**: Cloudflare D1（Drizzle ORM 経由の SQLite）

### デプロイ構成

| 環境 | トリガー | 内容 |
|------|---------|------|
| **ローカル** | `bun run dev` | `wrangler dev`（Workers ローカルシミュレーション） |
| **プレビュー** | PR 作成・同期・再オープン | PR ごとに独立した Worker と D1、共有 Pages プロジェクトの PR ブランチへデプロイ |
| **dev** | `dev` への push | 常設の dev 環境（`sapphire2-api-dev`） |
| **本番** | GitHub Release 公開 | CI 通過後に Worker + Pages をデプロイ |

## 2. 前提条件

- [Cloudflare](https://dash.cloudflare.com/sign-up) アカウント（Free plan OK）
- GitHub リポジトリの管理者権限（Secrets 設定に必要）
- [Bun](https://bun.sh/) がローカルにインストール済み
- [Node.js](https://nodejs.org/) 20.3.0 以上がローカルにインストール済み（Cloudflare Wrangler CLI の実行用。パッケージマネージャーは引き続き Bun）

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
ANTHROPIC_API_KEY=your-anthropic-api-key
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

`ANTHROPIC_API_KEY` と `GOOGLE_MAPS_API_KEY` は、AI 抽出または Google Places 検索を使う場合だけ必要です。

`apps/web/.env` は Vite クライアントを設定します。既定の `VITE_SERVER_URL` はローカル API の `http://localhost:8787` を指します。

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
| `ANTHROPIC_API_KEY` | Anthropic | AI 抽出を有効化 |
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

`release.yml` が tag と GitHub Release を公開し、その tag を指定して `production-deploy.yml` を明示的に dispatch します。既定の `GITHUB_TOKEN` で作成した Release は別 workflow を再帰起動しないためです。`production-deploy.yml` は外部の `release: published` と手動 `workflow_dispatch` にも対応します。処理順は CI → マイグレーション → Worker デプロイ → Pages デプロイです。

`concurrency` 設定により直列実行。CI 失敗時はデプロイをスキップ。

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
  +-> CI -> マイグレーション -> Worker デプロイ (sapphire2-api-dev) -> Pages デプロイ (dev)
```

### 本番デプロイ（release PR マージ時または手動 dispatch）

```
release PR を main へマージ
  |
  +-> release.yml: tag + GitHub Release を作成
        |
        +-> tag を指定して production-deploy.yml を dispatch
              |
              +-> CI (型チェック, lint, テスト)
                    |
                    +-> マイグレーション -> Worker デプロイ -> Pages デプロイ
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
