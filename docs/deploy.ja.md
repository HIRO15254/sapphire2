# デプロイガイド

> **[English version](deploy.md)**

## 1. 概要

このリポジトリは Cloudflare Workers + Neon を前提とした構成です。

- **API サーバー**: Cloudflare Workers（Hono）
- **フロントエンド**: Cloudflare Pages（Vite SPA）
- **データベース**: Neon PostgreSQL（`@neondatabase/serverless`）

### デプロイ構成

| 環境 | トリガー | 内容 |
|------|---------|------|
| **ローカル** | `bun run dev` | `wrangler dev`（Workers ローカルシミュレーション） |
| **プレビュー** | PR オープン | PR ごとに独立した Worker + Pages + Neon ブランチ |
| **本番** | master push | CI 通過後に Worker + Pages をデプロイ |

## 2. 前提条件

- [Cloudflare](https://dash.cloudflare.com/sign-up) アカウント（Free plan OK）
- [Neon](https://console.neon.tech/signup) アカウント（Free plan OK）
- GitHub リポジトリの管理者権限（Secrets 設定に必要）
- [Bun](https://bun.sh/) がローカルにインストール済み

## 3. ローカル開発

### 3.1 Neon データベース作成

ローカル開発でも Neon を使用します（`@neondatabase/serverless` は HTTP で接続するため、ローカル PostgreSQL は使用不可）。

1. [Neon コンソール](https://console.neon.tech/) でプロジェクトを作成
2. 「Connection Details」から接続文字列をコピー

### 3.2 環境変数の設定

`apps/server/.dev.vars.example` をコピーして `.dev.vars` を作成します。

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

`.dev.vars` を編集:

```
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
```

### 3.3 マイグレーション実行

```bash
DATABASE_URL="your-neon-connection-string" bun run db:migrate
```

### 3.4 開発サーバー起動

```bash
bun run dev
```

- API: `http://localhost:8787`（`wrangler dev`）
- Web: `http://localhost:3001`（Vite）

## 4. Neon セットアップ（CI用）

### 4.1 API キー取得

1. Neon コンソール → 左下「Account Settings」→「API Keys」
2. 「Generate new API key」→ キーをコピー

### 4.2 プロジェクト ID の確認

```
https://console.neon.tech/app/projects/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        この部分がプロジェクト ID
```

## 5. Cloudflare セットアップ

### 5.1 API トークン作成

1. [API トークン画面](https://dash.cloudflare.com/profile/api-tokens) → 「Create Token」
2. 「Custom token」を選択し、以下の権限を付与:
   - **Account** > **Cloudflare Pages** > **Edit**
   - **Account** > **Workers Scripts** > **Edit**

### 5.2 Account ID の確認

Cloudflare ダッシュボード →「Workers & Pages」概要ページ → 右サイドバー

### 5.3 Pages プロジェクト作成

```bash
npx wrangler pages project create sapphire2-web
```

## 6. GitHub Secrets 設定

### リポジトリ変数（Variables）

**Settings > Secrets and variables > Actions > Variables タブ > New repository variable** から追加。

| 変数名 | 取得元 | 説明 |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Workers & Pages 概要ページ（シークレットではない — プレビュー URL の構築に使用） |

### リポジトリシークレット（Secrets）

**Settings > Secrets and variables > Actions > Secrets タブ > New repository secret** から追加。

#### 共通

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Workers/Pages 編集権限付きトークン |
| `BETTER_AUTH_SECRET` | 自分で生成 | `openssl rand -base64 32` で32文字以上 |

### プレビュー環境用

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `NEON_PROJECT_ID` | Neon コンソール | プロジェクトダッシュボード URL から確認 |
| `NEON_API_KEY` | Neon Account Settings | API Keys ページで生成 |

### 本番環境用

| Secret 名 | 取得元 | 説明 |
|---|---|---|
| `PRODUCTION_DATABASE_URL` | Neon コンソール | メインブランチの接続文字列 |
| `PRODUCTION_API_URL` | Cloudflare | 本番 Worker URL（例: `https://sapphire2-api.<subdomain>.workers.dev`） |
| `PRODUCTION_WEB_URL` | Cloudflare | 本番 Pages URL（例: `https://sapphire2-web.pages.dev`） |

> `PRODUCTION_API_URL` / `PRODUCTION_WEB_URL` は初回デプロイ後に実際の URL を確認して設定。カスタムドメインがあればそちらを指定。

## 7. カスタマイズ

### Worker 名の変更

`apps/server/wrangler.toml` の `name` を変更した場合:

- `.github/workflows/preview-deploy.yml` の `WORKER_NAME` 変数
- `.github/workflows/preview-cleanup.yml` の `--name` 引数

### Pages プロジェクト名の変更

`preview-deploy.yml` の `PAGES_PROJECT` 変数を変更。

### 本番デプロイ

`.github/workflows/production-deploy.yml` により自動化済み。master push 時に CI → マイグレーション → Worker デプロイ → Pages デプロイ。

`concurrency` 設定により直列実行。CI 失敗時はデプロイをスキップ。

## 8. 動作確認

### プレビュー

1. テストブランチを作成して PR を出す
2. Actions タブで「Preview Deploy」を確認
3. PR コメントにプレビュー URL が投稿される
4. PR クローズで自動クリーンアップ

### 本番

1. master に push（または PR をマージ）
2. Actions タブで「Production Deploy」を確認
3. Worker URL と Pages URL にアクセス

## 9. トラブルシューティング

### `CLOUDFLARE_API_TOKEN` 権限不足

```
Error: Authentication error
```

API トークンに Workers Scripts **Edit** + Cloudflare Pages **Edit** 権限があるか確認。

### Neon ブランチ作成失敗

```
Error: Could not find project
```

`NEON_API_KEY` の有効性と `NEON_PROJECT_ID` の一致を確認。

### Worker デプロイ失敗

```
Error: compatibility_date is too old
```

`apps/server/wrangler.toml` の `compatibility_date` を更新。

### マイグレーション失敗

```
Error: connection refused
```

`DATABASE_URL` のフォーマット確認:
```
postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
```

### Pages デプロイ失敗

```
Error: A project with this name does not exist
```

`npx wrangler pages project create sapphire2-web` で事前にプロジェクト作成が必要。

## 10. アーキテクチャ

### プレビューデプロイ（PR オープン時）

```
PR open/synchronize
  |
  +-> Neon ブランチ作成 (pr-<番号>)
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
  +-> Worker 削除 → Neon ブランチ削除 → PR コメント更新
```

### 本番デプロイ（master push 時）

```
push to master
  |
  +-> CI (型チェック, lint, テスト)
        |
        +-> マイグレーション → Worker デプロイ → Pages デプロイ
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
                                  │   Neon        │
                                  │   (PostgreSQL)│
                                  └───────────────┘
```
