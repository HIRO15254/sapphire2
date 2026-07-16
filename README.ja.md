# sapphire2

> **[English version](README.md)**

[Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack) で作成されたモダン TypeScript スタックプロジェクトです。React, TanStack Router, Hono, tRPC などを組み合わせています。

## 技術スタック

- **React 19** + **TanStack Router** - 型安全なファイルベースルーティング
- **TailwindCSS** + **shadcn/ui** - スタイリングと UI コンポーネント
- **Hono** - Cloudflare Workers 上の軽量サーバーフレームワーク
- **tRPC v11** - エンドツーエンド型安全 API
- **Drizzle ORM** + **Cloudflare D1** - データベース（SQLite）
- **Better Auth** - 認証（メール/パスワード、Google/Discord OAuth）
- **Bun** - パッケージマネージャー兼ランタイム
- **Biome** (Ultracite) - リンティングとフォーマット
- **Husky** - Git フック
- **PWA** - Progressive Web App サポート

## プロジェクト構成

```
sapphire2/
├── apps/
│   ├── web/            # フロントエンド (React 19 + Vite + TanStack Router)
│   └── server/         # API (Hono + tRPC on Cloudflare Workers)
├── packages/
│   ├── api/            # tRPC ルーターとコンテキスト
│   ├── auth/           # Better Auth 設定
│   ├── config/         # 共有 TypeScript 設定
│   ├── db/             # Drizzle ORM スキーマとマイグレーション
│   └── env/            # 環境変数バリデーション (Zod)
├── AGENTS.md           # エージェント向けガイド (正本); CLAUDE.md は @AGENTS.md でインポート
├── .claude/            # Claude Code 設定 (rules, skills, settings)
├── docs/
│   ├── deploy.md       # デプロイガイド (EN)
│   └── deploy.ja.md    # デプロイガイド (JA)
└── .github/workflows/
    ├── ci.yml               # PR チェック (型チェック, lint, テスト)
    ├── claude.yml           # Claude GitHub 連携
    ├── pr-target-guard.yml  # `main` のリリースブランチ制約
    ├── pre-merge-review.yml # マージ前レビュー自動化
    ├── preview-deploy.yml   # PR ごとのプレビュー環境
    ├── preview-cleanup.yml  # PR クローズ時クリーンアップ
    ├── dev-deploy.yml       # `dev` への push 時の dev 環境デプロイ
    ├── release.yml          # Release 作成と本番デプロイ起動
    ├── production-deploy.yml # 本番デプロイ
    └── project-sync.yml     # 任意の GitHub Project 同期（要設定）
```

## はじめかた

### 前提条件

- [Bun](https://bun.sh/) がインストール済み
- [Node.js](https://nodejs.org/) 20.3.0 以上がインストール済み（Cloudflare Wrangler CLI の実行用。パッケージマネージャーは引き続き Bun）

### セットアップ

1. 依存パッケージのインストール:

```bash
bun install
```

2. サーバーと Web の環境変数テンプレートをコピーして、サーバー側の値を設定:

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/web/.env.example apps/web/.env
```

`apps/server/.dev.vars` はサーバー側の設定です。値を設定してください。

```env
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

`apps/web/.env` は Vite クライアントを設定します。既定の `VITE_SERVER_URL` はローカル API の `http://localhost:8787` を指します。

3. データベースマイグレーションを実行:

```bash
bun run db:migrate:local
```

4. 開発サーバーを起動:

```bash
bun run dev
```

- Web: [http://localhost:3001](http://localhost:3001)
- API: [http://localhost:8787](http://localhost:8787)

## 利用可能なスクリプト

| スクリプト | 説明 |
|-----------|------|
| `bun run dev` | 全アプリを開発モードで起動 |
| `bun run build` | 全アプリをビルド |
| `bun run dev:web` | Web アプリのみ起動 |
| `bun run dev:server` | API サーバーのみ起動（Wrangler は Node.js で実行） |
| `bun run check-types` | 現在スクリプトを定義している Web / Server の TypeScript 型チェック |
| `bun run check` | CI と同じ lint・フォーマット検査 |
| `bun run check:rules` | 決定的なプロジェクト規約検査 |
| `bun run db:generate` | マイグレーションファイルを生成 |
| `bun run db:migrate:local` | ローカル D1 にマイグレーションを適用 |
| `bun run db:migrate:remote` | リモート D1 にマイグレーションを適用 |
| `bun run db:studio` | Drizzle Studio を開く |
| `bun run lint` | リント & フォーマットチェック (Ultracite) |
| `bun run fix` | リンティングとフォーマットの自動修正 |
| `bun run test` | テスト実行 |
| `bun run test:ci` | verbose reporter を使う CI 向けテスト実行 |
| `bun run test:watch` | テスト実行（監視モード） |

## デプロイ

**Cloudflare Workers**（API）+ **Cloudflare Pages**（Web）+ **Cloudflare D1**（DB）にデプロイします。

- **プレビュー**: PR ごとに独立した Worker と D1、および共有 Pages プロジェクトの PR ブランチへデプロイ
- **dev**: 常設の dev 環境。`dev` への push で自動デプロイ
- **本番**: GitHub Release の公開で自動デプロイ

詳細なセットアップ手順は [docs/deploy.ja.md](docs/deploy.ja.md) を参照してください。
