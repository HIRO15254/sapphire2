# my-better-t-app

> **[English version](README.md)**

[Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack) で作成されたモダン TypeScript スタックプロジェクトです。React, TanStack Router, Hono, tRPC などを組み合わせています。

## 技術スタック

- **React 19** + **TanStack Router** - 型安全なファイルベースルーティング
- **TailwindCSS** + **shadcn/ui** - スタイリングと UI コンポーネント
- **Hono** - Cloudflare Workers 上の軽量サーバーフレームワーク
- **tRPC v11** - エンドツーエンド型安全 API
- **Drizzle ORM** + **Neon PostgreSQL** - データベース（サーバーレス HTTP ドライバ）
- **Better Auth** - 認証（メール/パスワード、PBKDF2）
- **Bun** - パッケージマネージャー兼ランタイム
- **Biome** (Ultracite) - リンティングとフォーマット
- **Husky** - Git フック
- **PWA** - Progressive Web App サポート

## プロジェクト構成

```
my-better-t-app/
├── apps/
│   ├── web/            # フロントエンド (React 19 + Vite + TanStack Router)
│   └── server/         # API (Hono + tRPC on Cloudflare Workers)
├── packages/
│   ├── api/            # tRPC ルーターとコンテキスト
│   ├── auth/           # Better Auth 設定
│   ├── config/         # 共有 TypeScript 設定
│   ├── db/             # Drizzle ORM スキーマとマイグレーション
│   └── env/            # 環境変数バリデーション (Zod)
├── docs/
│   ├── deploy.md       # デプロイガイド (EN)
│   └── deploy.ja.md    # デプロイガイド (JA)
└── .github/workflows/
    ├── ci.yml              # PR チェック (型チェック, lint, テスト)
    ├── preview-deploy.yml  # PR プレビュー環境
    ├── preview-cleanup.yml # PR クローズ時クリーンアップ
    └── production-deploy.yml # master push 時の本番デプロイ
```

## はじめかた

### 前提条件

- [Bun](https://bun.sh/) がインストール済み
- [Neon](https://neon.tech/) PostgreSQL データベース

### セットアップ

1. 依存パッケージのインストール:

```bash
bun install
```

2. 環境変数テンプレートをコピーして値を設定:

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
```

3. データベースにスキーマを反映:

```bash
bun run db:push
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
| `bun run dev:server` | API サーバーのみ起動 (`wrangler dev`) |
| `bun run check-types` | 全パッケージの TypeScript 型チェック |
| `bun run db:push` | スキーマ変更をデータベースに反映 |
| `bun run db:generate` | マイグレーションファイルを生成 |
| `bun run db:migrate` | マイグレーションを実行 |
| `bun run db:studio` | Drizzle Studio を開く |
| `bun run check` | リンティングとフォーマットのチェック |
| `bun run fix` | リンティングとフォーマットの自動修正 |
| `bun run test` | テスト実行 |
| `bun run test:watch` | テスト実行（監視モード） |

## デプロイ

**Cloudflare Workers**（API）+ **Cloudflare Pages**（Web）+ **Neon PostgreSQL**（DB）にデプロイします。

- **プレビュー**: PR ごとに自動作成（Worker + Pages + Neon ブランチ）
- **本番**: `master` への push で自動デプロイ

詳細なセットアップ手順は [docs/deploy.ja.md](docs/deploy.ja.md) を参照してください。
