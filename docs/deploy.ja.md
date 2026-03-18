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
| **プレビュー** | PR オープン | PR ごとに独立した Worker + Pages + D1 データベース |
| **本番** | master push | CI 通過後に Worker + Pages をデプロイ |

## 2. 前提条件

- [Cloudflare](https://dash.cloudflare.com/sign-up) アカウント（Free plan OK）
- GitHub リポジトリの管理者権限（Secrets 設定に必要）
- [Bun](https://bun.sh/) がローカルにインストール済み

> D1 データベースは Wrangler が自動的に作成するため、別途データベースのアカウントは不要です。

## 3. ローカル開発

### 3.1 環境変数の設定

`apps/server/.dev.vars.example` をコピーして `.dev.vars` を作成します。

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

`.dev.vars` を編集:

```
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

### 3.2 マイグレーション実行

```bash
bun run db:migrate:local
```

### 3.3 開発サーバー起動

```bash
bun run dev
```

- API: `http://localhost:8787`（`wrangler dev`）
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
npx wrangler pages project create sapphire2-web
```

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

## 6. GitHub App セットアップ（Bot名義PR用）

speckit ワークフローのエージェント（spec-writer, plan-writer, implementer）は GitHub App 経由で PR を作成する。PR の作成者が Bot になるため、開発者自身がセルフレビュー可能。

### 6.1 GitHub App 作成

1. GitHub > **Settings** > **Developer settings** > **GitHub Apps** > **New GitHub App**
2. 設定:
   - **Name**: `sapphire2-bot`（任意）
   - **Homepage URL**: リポジトリ URL
   - **Webhook**: **Active** のチェックを外す（不要）
   - **Permissions**:
     - Repository > **Contents**: Read & write
     - Repository > **Pull requests**: Read & write
     - Repository > **Issues**: Read & write
   - **Where can this GitHub App be installed?**: Only on this account
3. 作成後、**App ID** を控える
4. **Private key** を生成してダウンロード

### 6.2 App をリポジトリにインストール

GitHub App 設定 > **Install App** > リポジトリを選択

## 7. GitHub Secrets 設定

### リポジトリ変数（Variables）

**Settings > Secrets and variables > Actions > Variables タブ > New repository variable** から追加。

| 変数名 | 取得元 | 説明 |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Workers & Pages 概要ページ |
| `BOT_APP_ID` | GitHub App | App 設定ページの App ID |

### リポジトリシークレット（Secrets）

**Settings > Secrets and variables > Actions > Secrets タブ > New repository secret** から追加。

#### 共通

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Workers/Pages/D1 編集権限付きトークン |
| `BETTER_AUTH_SECRET` | 自分で生成 | `openssl rand -base64 32` で32文字以上 |
| `BOT_PRIVATE_KEY` | GitHub App | App 設定からダウンロードした Private key（PEM形式） |

#### OAuth（Google/Discord）

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth 2.0 クライアント ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | OAuth 2.0 クライアント シークレット |
| `DISCORD_CLIENT_ID` | Discord Developer Portal | OAuth2 アプリケーション クライアント ID |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal | OAuth2 アプリケーション クライアント シークレット |

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

## 8. カスタマイズ

### Worker 名の変更

`apps/server/wrangler.toml` の `name` を変更した場合:

- `.github/workflows/preview-deploy.yml` の `WORKER_NAME` 変数
- `.github/workflows/preview-cleanup.yml` の `--name` 引数

### Pages プロジェクト名の変更

`preview-deploy.yml` の `PAGES_PROJECT` 変数を変更。

### 本番デプロイ

`.github/workflows/production-deploy.yml` により自動化済み。master push 時に CI → マイグレーション → Worker デプロイ → Pages デプロイ。

`concurrency` 設定により直列実行。CI 失敗時はデプロイをスキップ。

## 9. 動作確認

### プレビュー

1. テストブランチを作成して PR を出す
2. Actions タブで「Preview Deploy」を確認
3. PR コメントにプレビュー URL が投稿される
4. PR クローズで自動クリーンアップ

### 本番

1. master に push（または PR をマージ）
2. Actions タブで「Production Deploy」を確認
3. Worker URL と Pages URL にアクセス

## 10. トラブルシューティング

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

`npx wrangler pages project create sapphire2-web` で事前にプロジェクト作成が必要。

## 11. アーキテクチャ

### プレビューデプロイ（PR オープン時）

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
  +-> Worker 削除 -> D1 データベース削除 -> PR コメント更新
```

### 本番デプロイ（master push 時）

```
push to master
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
