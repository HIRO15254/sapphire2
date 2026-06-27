# sapphire2 アプリケーション仕様書

> 本仕様書は **2026-06-27** 時点のコードベース（コミット `6479dbf`）を解析して生成した、機能・データ・API・ロジックの仕様です。
> 対象は `packages/`（api / db / auth / env）および `apps/server/`・`apps/web/` のロジック層（フック・ユーティリティ・ルーター・スキーマ）です。
> **UI構造（コンポーネント階層・ページレイアウト・デザインシステム・見た目）は意図的に対象外とします。** 機能はUIではなく「ユーザーができること」「業務ルール」「データとロジック」の観点で記述します。

## 目次

- [1. 概要](#1-概要)
- [2. アーキテクチャと技術スタック](#2-アーキテクチャと技術スタック)
- [3. 用語集・ドメインモデル概要](#3-用語集ドメインモデル概要)
- [4. データモデル（DBスキーマ）](#4-データモデルdbスキーマ)
- [5. 認証・認可](#5-認証認可)
- [6. API仕様 - エンティティ管理](#6-api仕様---エンティティ管理)
- [7. API仕様 - トーナメント定義・セッション記録](#7-api仕様---トーナメント定義セッション記録)
- [8. API仕様 - ライブセッション・統計・AI抽出](#8-api仕様---ライブセッション統計ai抽出)
- [9. ドメイン・計算ロジック](#9-ドメイン計算ロジック)
- [10. 機能仕様 - 部屋・通貨・プレイヤー](#10-機能仕様---部屋通貨プレイヤー)
- [11. 機能仕様 - セッション・ライブ・統計・設定](#11-機能仕様---セッションライブ統計設定)
- [12. 環境・デプロイ・リリースフロー](#12-環境デプロイリリースフロー)
- [付録A. 整合性・補足メモ](#付録a-整合性補足メモ)

## 1. 概要

### 目的

sapphire2 は、ポーカープレイヤーが自身のプレイ実績を一元的に記録・管理し、収支とパフォーマンスを定量的に把握するための個人向け Web アプリケーション（PWA）である。キャッシュゲーム（リングゲーム）とトーナメントの双方を対象に、1回ごとのセッション結果・バンクロール（資金）の入出金・対戦相手やプレイ環境のメタデータを蓄積し、それらを集計した統計を通じて「自分は本当に勝てているのか」「どの会場・ステークスで成績が良いのか」をデータドリブンに判断できることを狙いとする。

解決する課題は次の3点に集約される。

- **記録の継続性**: プレイ直後の「ライブ記録」（イベントを逐次追記し終了時に確定）と、後から打ち込む「手動記録」の両経路を備え、状況に応じた記録手段を提供する。
- **資金の可視化**: 通貨（口座単位）ごとの残高を全取引の合計として常に正確に算出し、セッション収支を自動で台帳に反映する。
- **成績の客観評価**: 完了済みセッションを期間・種別・会場・通貨・正規化軸（通貨額 / BB・BI）で切り替えながら、累積収支・勝率・ROI・ITM・時給などの指標で振り返れるようにする。

### 主要ユースケース

- **進行中セッションのライブ記録**: 開始時のバイイン／スタックから始め、チップの増減・オールイン EV・着席プレイヤー・中断/再開などをイベントとして追記し、終了時に損益を確定して完了済みセッションへ合流させる。
- **過去セッションの手動入力**: ルーム・ルール（ブラインド構成等）・結果をウィザードで入力し、既存マスター（リングゲーム／トーナメント定義）から初期値を展開しつつスナップショットとして記録する。
- **バンクロール管理**: 通貨ごとに購入・ボーナス・セッション結果などの取引を記録し、残高を追跡する。
- **マスタデータ整備**: 会場（Room）、通貨、取引種別、対戦プレイヤーとタグ、ゲームルールテンプレートを登録・分類する。
- **統計の閲覧**: KPI カード・統計テーブル・累積収支グラフ・各種ブレイクダウンで実績を多角的に分析する。
- **更新通知の確認とアカウント設定**: リリースノートの既読管理、ソーシャル連携、テーマ切替などを行う。

### スコープ

**本仕様書が扱う範囲**: ドメインモデルとデータベーススキーマ、認証・認可、tRPC API の各ルーター（入力・戻り値・副作用・所有権検証）、ライブセッションのイベントソーシングと損益計算ロジック、統計・フォーマッタ等のドメインロジック、フロントエンドの機能仕様（各機能が提供する操作・業務ルール・バリデーション）、およびインフラ（環境変数・Cloudflare 構成・CI/CD・リリースフロー・PWA）。

**扱わない範囲**: 本仕様書は**UI 構造（画面レイアウト、コンポーネント階層、視覚デザイン、配色・タイポグラフィ等の見た目）を対象外**とする。これらは Sapphire 2 Design System および `.claude/rules/web-*.md` 等の別ドキュメントが規定する。本書が「機能仕様」として記述する操作・ルールは、その実現手段である具体的な画面構成とは独立している。また、ハンド単位の詳細記録（ハンドヒストリ）や、bb/100 などハンド数に依存する指標は本アプリの対象外である（ハンド数を追跡しないため意図的に省略）。

## 2. アーキテクチャと技術スタック

### アーキテクチャ概要

#### モノレポ構成

sapphire2 は Bun workspaces によるモノレポで、アプリ（`apps/`）と共有パッケージ（`packages/`）に分かれる。パッケージマネージャ・ランタイムは Bun に統一され、`npm` / `yarn` / `pnpm` は使用しない。

```text
apps/
  web/     React 19 SPA（Vite / TanStack Router / TanStack Query / tRPC client）
  server/  Hono on Cloudflare Workers（tRPC server / Better Auth）
packages/
  api/     tRPC ルーター群（クライアント型の源泉）
  db/      Drizzle スキーマ + マイグレーション（Cloudflare D1）
  auth/    Better Auth 設定（createAuth）
  env/     Zod 型付き環境変数
  config/  共有 TS / Biome 設定
```

#### 各層の責務

- **`apps/web`（フロント）**: React 19 の SPA。ルーティングは TanStack Router、サーバ状態は TanStack Query、サーバ通信は tRPC v11 クライアント経由。認証ガードは `__root` の `beforeLoad` でセッションを解決し、未認証は `/login` へリダイレクトする。ロジックは `useXxx` フックに集約され、コンポーネントはその戻り値を描画する。
- **`apps/server`（サーバ）**: Cloudflare Workers 上の Hono アプリ。全パスに CORS ミドルウェアを適用し、`/api/auth/*`（Better Auth）、`/trpc/*`（tRPC ミドルウェア）、`GET /`（ヘルスチェック）をマウントする。各リクエストで `createDb(c.env.DB)` と `createAuth(db, {...})` をリクエストスコープで生成する。
- **`packages/api`（API 層）**: tRPC v11 のルーター群。`publicProcedure`（`healthCheck` のみ）と `protectedProcedure`（認証必須）を提供し、各リソースは `userId` で所有者単位にスコープされる。クライアントの型はこのパッケージを源泉とする。
- **`packages/db`（DB 層）**: Drizzle ORM によるスキーマ定義（1ファイル1ドメイン、`schema.ts` に集約）、マイグレーション、定数。
- **`packages/auth` / `packages/env` / `packages/config`**: Better Auth 設定、Zod 型付き env、共有 TS/Biome 設定をそれぞれ担う。

#### データフロー（クライアント → tRPC → Drizzle → D1）

```text
[React コンポーネント] → useXxx フック
  → tRPC client（型は packages/api 由来）
  → HTTPS（Cookie 認証, sameSite=none / secure / httpOnly）
  → Hono (/trpc/*) → createContext（getSession でセッション解決, db, anthropicApiKey）
  → protectedProcedure（未認証は UNAUTHORIZED）
  → 所有権検証（userId 一致, NOT_FOUND → FORBIDDEN の順）
  → Drizzle ORM クエリ
  → Cloudflare D1（SQLite）
```

書き込み系はサーバで `crypto.randomUUID()` により ID を採番し、変更後の行を再取得して返す。フロントは TanStack Query で楽観的更新を行い、必ず `utils/optimistic-update.ts` のヘルパ経由でキャッシュを書き換え、`onSettled` で `invalidateQueries` する。

#### 型安全性の担保

- tRPC v11 によりサーバの入力（Zod スキーマ）・出力の型がクライアントへエンドツーエンドに伝播する。`packages/api` がクライアント型の単一の源泉。
- 入力検証は全面的に Zod（`import z from "zod"` の default import 規約）。
- DB スキーマは Drizzle により型付けされ、列挙値・定数は `packages/db/src/constants*` に一元化される。
- 環境変数は `packages/env` の Zod スキーマで検証（クライアントは `VITE_` プレフィックスのみ公開、遅延 Proxy で初回アクセス時に検証）。
- 静的検査は TypeScript（`tsc --noEmit`）と Ultracite（Biome プリセット）で、テストは Vitest で担保する。

#### 技術スタック表

| 領域 | 採用技術 |
|---|---|
| ランタイム / パッケージ管理 | Bun 1.3（workspaces） |
| フロント | React 19, Vite, TanStack Router, TanStack Query, tRPC v11 client, Tailwind v4, shadcn/ui, @tanstack/react-form |
| サーバ | Hono on Cloudflare Workers, tRPC v11 server, Better Auth |
| DB / ORM | Cloudflare D1（SQLite）, Drizzle ORM |
| 検証 | Zod |
| 認証 | Better Auth（メール/パスワード + Google / Discord OAuth）, PBKDF2 自前ハッシュ |
| テスト | Vitest + Testing Library（jsdom） |
| Lint / Format | Ultracite（Biome プリセット） |
| AI 連携 | Anthropic SDK（`claude-opus-4-8`、トーナメント情報・着席プレイヤーの構造化抽出） |
| 配信 | Cloudflare Pages（Web）+ Workers（API）, PWA（vite-plugin-pwa） |

## 3. 用語集・ドメインモデル概要

| 用語（テーブル/型） | 物理名 | 定義 | 主な所属・関連 |
|---|---|---|---|
| User | `user` | アカウント本体。全ドメインデータの所有者の起点 | 1 — 多: Room / Currency / Player / GameSession など。削除で全関連が cascade |
| Room（部屋/会場） | `room` | ポーカー会場・店舗のマスタ | User に属す。配下に RingGame / Tournament / GameSession を持つ |
| Currency（通貨） | `currency` | バンクロールの口座単位。残高は取引合計で算出 | User に属す。1 — 多 CurrencyTransaction |
| TransactionType（取引種別） | `transaction_type` | 入出金の種別マスタ（既定: Purchase / Bonus / Session Result / Other） | User に属す。使用中は削除不可 |
| CurrencyTransaction（通貨取引） | `currency_transaction` | 通貨残高の符号付き入出金。`sessionId` 非 null はセッション由来で編集/削除不可 | Currency / TransactionType / GameSession を参照 |
| Player（プレイヤー） | `player` | 対戦相手等の人物記録。`isTemporary` で仮登録を区別 | User に属す。PlayerTag と多対多 |
| PlayerTag（プレイヤータグ） | `player_tag` | プレイヤー分類タグ（8色 enum: gray/red/orange/yellow/green/blue/purple/pink） | User に属す。中間 `player_to_player_tag`（`position` で順序）で Player と多対多 |
| RingGame（リングゲーム） | `ring_game` | キャッシュゲーム卓のルールテンプレート（SB/BB/Straddle/Ante 等）。`archivedAt` でソフトデリート | Room（任意）/ Currency に属す |
| Tournament（トーナメント） | `tournament` | トーナメントのルールテンプレート。`archivedAt` でソフトデリート | Room（必須）/ Currency に属す。子に BlindLevel / ChipPurchase / TournamentTag |
| BlindLevel（ブラインドレベル） | `blind_level` | トーナメントテンプレートのブラインドストラクチャ1レベル（`isBreak` で休憩） | Tournament に属す。`level` 昇順 |
| TournamentChipPurchase（チップ購入定義） | `tournament_chip_purchase` | リバイ/アドオン等の購入「定義（メニュー）」。実購入回数はセッション側に保持 | Tournament に属す。`sortOrder` 昇順 |
| TournamentTag | `tournament_tag` | トーナメントテンプレート専用タグ（名前のみ、PlayerTag とは別系統） | Tournament に属す |
| GameSession（セッション本体） | `game_session` | 1回のプレイ。`kind`(cash_game/tournament) × `source`(manual/live) × `status`(active/paused/completed) | User に属す。1:1 で詳細行、1 — 多 SessionEvent |
| SessionCashDetail / SessionTournamentDetail | `session_cash_detail` / `session_tournament_detail` | セッションの収支とルールの**スナップショット**（作成時に凍結、マスタ変更は伝播しない） | GameSession と 1:1（`session_id` が主キー兼 FK） |
| SessionEvent（セッションイベント） | `session_event` | ライブセッションの追記イベント（11種: session_start/end, pause/resume, chips_add_remove, all_in, purchase_chips, update_stack, player_join/leave, memo） | GameSession に属す。`occurredAt`（分丸め）+ `sortOrder` で整列 |
| LiveSession（ライブセッション） | （`game_session` の `source="live"`） | 進行中セッションの論理概念。専用テーブルを持たず SessionEvent 列を畳んで状態・損益・着席を導出（イベントソーシング） | 同時アクティブは1ユーザ1つ |
| SessionTag（セッションタグ） | `session_tag` | セッション分類タグ（名前のみ） | User に属す。中間 `session_to_session_tag` で GameSession と多対多 |
| Stats（統計） | （導出） | 完了済みセッションの集計。通貨額 / 正規化（BB・BI）軸、期間・種別・会場・通貨でフィルタ | 派生データ（テーブルなし）。KPI / テーブル / 累積収支 / ブレイクダウン |
| UpdateNote（更新ノート） | （`virtual:update-notes` + `update_note_view`） | リリースノート。既読は `update_note_view`（`userId` 所有）で管理 | データは GitHub Releases 由来、既読は User に属す |

#### 相互関係の要約

- **所有権の起点**（`userId` 直参照・cascade）は User の直下にある `room` / `currency` / `transaction_type` / `player` / `player_tag` / `game_session` / `session_tag` / `update_note_view`。それ以外の子テーブルは親経由で間接的にユーザにスコープされる。
- **テンプレート → セッション**: RingGame / Tournament はルールの「テンプレート」。セッション作成時にその内容を SessionCashDetail / SessionTournamentDetail（およびトーナメント構造）へコピーして**スナップショット凍結**するため、後からテンプレートを変更してもセッションの記録値は不変。
- **ライブ → 完了 → 台帳**: LiveSession は SessionEvent を畳んで損益を再計算し、完了時に GameSession の `status`/日時/詳細行と CurrencyTransaction（`Session Result` 種別）へ一括同期する。
- **タグの二系統**: PlayerTag（色つき、Player と多対多）、TournamentTag（名前のみ、Tournament 専用）、SessionTag（名前のみ、Session と多対多）は互いに独立。

## 4. データモデル（DBスキーマ）

DB は **Cloudflare D1 (SQLite)** を **Drizzle ORM** で定義する。スキーマ実体は `packages/db/src/schema/*.ts` に1ファイル1ドメインで分割定義され、`packages/db/src/schema.ts` がそれら全テーブルとリレーション定義を `schema` オブジェクトに集約する。列挙値・定数は `packages/db/src/constants.ts` および `packages/db/src/constants/*.ts` に置かれる。

共通規約:

- 主キー `id` は原則 `text` 型（アプリ生成 ID）。中間テーブルとスナップショット系（1対1）テーブルは複合主キーまたは外部キー兼主キーを採用する。
- タイムスタンプ列は `integer({ mode: "timestamp" })`（Unix epoch 秒）。`createdAt` のデフォルトは SQLite の `(unixepoch())`。`updatedAt` は Drizzle の `$onUpdate(() => new Date())` で書き込み時に更新される。
- 真偽値は `integer({ mode: "boolean" })`。
- ほぼ全テーブルがユーザースコープを持ち、`userId` または親エンティティ経由で `user.id` を参照し、ユーザー削除時に `onDelete: "cascade"` で連鎖削除される。

#### 認証系テーブル (Better Auth / `schema/auth.ts`)

##### `user`（物理名 `user`） — アカウント本体

| カラム | 型 | NULL | デフォルト | 制約 |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `name` | text | × | — | |
| `email` | text | × | — | UNIQUE |
| `emailVerified` (`email_verified`) | boolean | × | `false` | |
| `image` | text | ○ | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | `unixepoch()` | `$onUpdate` |

##### `session`（物理名 `session`） — 認証セッション（ログインセッション。ゲームの `game_session` とは別物）

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `expiresAt` (`expires_at`) | timestamp | × | — | |
| `token` | text | × | — | UNIQUE |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |
| `ipAddress` (`ip_address`) | text | ○ | — | |
| `userAgent` (`user_agent`) | text | ○ | — | |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |

インデックス: `session_userId_idx (user_id)`。

##### `account`（物理名 `account`） — 外部プロバイダ / パスワード資格情報

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `accountId` (`account_id`) | text | × | — | |
| `providerId` (`provider_id`) | text | × | — | |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `accessToken` (`access_token`) | text | ○ | — | |
| `refreshToken` (`refresh_token`) | text | ○ | — | |
| `idToken` (`id_token`) | text | ○ | — | |
| `accessTokenExpiresAt` (`access_token_expires_at`) | timestamp | ○ | — | |
| `refreshTokenExpiresAt` (`refresh_token_expires_at`) | timestamp | ○ | — | |
| `scope` | text | ○ | — | |
| `password` | text | ○ | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `account_userId_idx (user_id)`。

##### `verification`（物理名 `verification`） — メール確認等の検証トークン

| カラム | 型 | NULL | デフォルト | 制約 |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `identifier` | text | × | — | |
| `value` | text | × | — | |
| `expiresAt` (`expires_at`) | timestamp | × | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | `unixepoch()` | `$onUpdate` |

インデックス: `verification_identifier_idx (identifier)`。`verification` には Drizzle relations 定義はない。

リレーション: `user` 1 — 多 `session` / `account`。`session`・`account` はそれぞれ `user` に逆参照。

#### マスタ系テーブル

##### `room`（物理名 `room` / `schema/room.ts`） — 会場・店舗マスタ

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `memo` | text | ○ | — | |
| `isFavorite` (`is_favorite`) | boolean | × | `false` | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `room_userId_idx (user_id)`。リレーション: `room` 多 — 1 `user`（`room` は `ringGame` / `tournament` / `gameSession` から参照されるが、`roomRelations` 上は `user` のみ定義）。

##### `currency`（物理名 `currency` / `schema/currency.ts`） — 通貨・スコア単位マスタ

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `unit` | text | ○ | — | |
| `description` | text | ○ | — | リッチテキスト説明（サニタイズ済み HTML として保存、SA2-25） |
| `isFavorite` (`is_favorite`) | boolean | × | `false` | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `currency_userId_idx (user_id)`。

##### `transaction_type`（物理名 `transaction_type` / `schema/currency.ts`） — 入出金種別マスタ

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `transactionType_userId_idx (user_id)`。デフォルト種別は定数 `DEFAULT_TRANSACTION_TYPES = ["Purchase", "Bonus", "Session Result", "Other"]`（`constants.ts`）。

##### `currency_transaction`（物理名 `currency_transaction` / `schema/currency.ts`） — 通貨残高の入出金トランザクション

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `currencyId` (`currency_id`) | text | × | — | FK → `currency.id` ON DELETE CASCADE |
| `transactionTypeId` (`transaction_type_id`) | text | × | — | FK → `transaction_type.id`（onDelete 指定なし＝ RESTRICT 相当） |
| `sessionId` (`session_id`) | text | ○ | — | FK → `game_session.id` ON DELETE CASCADE（セッション結果由来の取引を紐付け） |
| `amount` | integer | × | — | 符号付き（入金 / 出金） |
| `transactedAt` (`transacted_at`) | timestamp | × | — | |
| `memo` | text | ○ | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | （`updatedAt` なし） |

インデックス: `currencyTransaction_currencyId_idx (currency_id)`, `currencyTransaction_sessionId_idx (session_id)`。

通貨系リレーション: `currency` 1 — 多 `currency_transaction`、かつ `currency` 多 — 1 `user`。`transaction_type` 1 — 多 `currency_transaction`、`transaction_type` 多 — 1 `user`。`currency_transaction` は `currency` / `transaction_type` / `gameSession` の各 1 を逆参照。

##### `player`（物理名 `player` / `schema/player.ts`） — 対戦プレイヤー名簿

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `memo` | text | ○ | — | |
| `isTemporary` (`is_temporary`) | boolean | × | `false` | 一時登録プレイヤーかどうか |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `player_userId_idx (user_id)`。

##### `player_tag`（物理名 `player_tag` / `schema/player.ts`） — プレイヤー分類タグ

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `color` | text | × | `"gray"` | 値域は `TAG_COLOR_NAMES`（下記） |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `playerTag_userId_idx (user_id)`。

##### `player_to_player_tag`（物理名 `player_to_player_tag` / `schema/player.ts`） — プレイヤー↔タグの多対多中間テーブル

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `playerId` (`player_id`) | text | × | — | FK → `player.id` ON DELETE CASCADE / 複合 PK の一部 |
| `playerTagId` (`player_tag_id`) | text | × | — | FK → `player_tag.id` ON DELETE CASCADE / 複合 PK の一部 |
| `position` | integer | × | `0` | タグ表示順 |

複合主キー: `(player_id, player_tag_id)`。リレーション: `player` 多 — 多 `player_tag`（中間 `player_to_player_tag` 経由。`player.tagLinks` / `playerTag.playerLinks` で多リンク、中間行は両側の 1 を逆参照）。

#### ゲームルール（テンプレート）系テーブル

##### `ring_game`（物理名 `ring_game` / `schema/ring-game.ts`） — キャッシュゲーム（リングゲーム）のルールテンプレート

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `roomId` (`room_id`) | text | ○ | — | FK → `room.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `variant` | text | × | `"nlh"` | 値域は `GAME_VARIANTS` のキー（現状 `nlh` のみ） |
| `blind1` | integer | ○ | — | SB |
| `blind2` | integer | ○ | — | BB |
| `blind3` | integer | ○ | — | Straddle |
| `ante` | integer | ○ | — | |
| `anteType` (`ante_type`) | text | ○ | — | API 層の値域は `"none" / "all" / "bb"` |
| `minBuyIn` (`min_buy_in`) | integer | ○ | — | |
| `maxBuyIn` (`max_buy_in`) | integer | ○ | — | |
| `tableSize` (`table_size`) | integer | ○ | — | |
| `currencyId` (`currency_id`) | text | ○ | — | FK → `currency.id` ON DELETE SET NULL |
| `memo` | text | ○ | — | |
| `archivedAt` (`archived_at`) | timestamp | ○ | — | アーカイブ日時（NULL = 有効） |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `ringGame_roomId_idx (room_id)`。リレーション: `ring_game` 多 — 1 `room`、多 — 1 `currency`。

##### `tournament`（物理名 `tournament` / `schema/tournament.ts`） — トーナメントのルールテンプレート

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `roomId` (`room_id`) | text | × | — | FK → `room.id` ON DELETE CASCADE（`ring_game` と異なり NOT NULL） |
| `name` | text | × | — | |
| `variant` | text | × | `"nlh"` | `GAME_VARIANTS` のキー |
| `buyIn` (`buy_in`) | integer | ○ | — | |
| `entryFee` (`entry_fee`) | integer | ○ | — | |
| `startingStack` (`starting_stack`) | integer | ○ | — | |
| `bountyAmount` (`bounty_amount`) | integer | ○ | — | |
| `tableSize` (`table_size`) | integer | ○ | — | |
| `currencyId` (`currency_id`) | text | ○ | — | FK → `currency.id` ON DELETE SET NULL |
| `memo` | text | ○ | — | |
| `archivedAt` (`archived_at`) | timestamp | ○ | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `tournament_roomId_idx (room_id)`。

##### `blind_level`（物理名 `blind_level` / `schema/tournament.ts`） — トーナメントテンプレートのブラインドストラクチャ（レベル定義）

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `tournamentId` (`tournament_id`) | text | × | — | FK → `tournament.id` ON DELETE CASCADE |
| `level` | integer | × | — | |
| `isBreak` (`is_break`) | boolean | × | `false` | 休憩レベルか |
| `blind1` | integer | ○ | — | |
| `blind2` | integer | ○ | — | |
| `blind3` | integer | ○ | — | |
| `ante` | integer | ○ | — | |
| `minutes` | integer | ○ | — | |

インデックス: `blindLevel_tournamentId_idx (tournament_id)`。

##### `tournament_chip_purchase`（物理名 `tournament_chip_purchase` / `schema/tournament.ts`） — トーナメントテンプレートのチップ購入（アドオン / リバイ）定義

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `tournamentId` (`tournament_id`) | text | × | — | FK → `tournament.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `cost` | integer | × | — | |
| `chips` | integer | × | — | |
| `sortOrder` (`sort_order`) | integer | × | `0` | |

インデックス: `tournamentChipPurchase_tournamentId_idx (tournament_id)`。

##### `tournament_tag`（物理名 `tournament_tag` / `schema/tournament-tag.ts`） — トーナメントテンプレートに付与するタグ

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `tournamentId` (`tournament_id`) | text | × | — | FK → `tournament.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |

インデックス: `tournamentTag_tournamentId_idx (tournament_id)`。

トーナメント系リレーション: `tournament` 多 — 1 `room` / `currency`、`tournament` 1 — 多 `blind_level` / `tournament_chip_purchase` / `tournament_tag`。子テーブルはいずれも `tournament` の 1 を逆参照。

#### セッション本体

##### `game_session`（物理名 `game_session` / `schema/session.ts`） — 1回のプレイセッション（キャッシュ / トーナメント、手動入力 / ライブ記録の共通本体）

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `kind` | text | × | — | セッション種別。値域 `"cash_game" / "tournament"` |
| `status` | text | × | — | `SESSION_STATUSES` = `"active" / "paused" / "completed"` |
| `source` | text | × | — | 入力経路。`"manual"`（手動入力）/ `"live"`（ライブ記録） |
| `sessionDate` (`session_date`) | timestamp | × | — | セッション日 |
| `startedAt` (`started_at`) | timestamp | ○ | — | |
| `endedAt` (`ended_at`) | timestamp | ○ | — | |
| `breakMinutes` (`break_minutes`) | integer | ○ | — | 休憩合計（分） |
| `memo` | text | ○ | — | |
| `roomId` (`room_id`) | text | ○ | — | FK → `room.id` ON DELETE SET NULL |
| `currencyId` (`currency_id`) | text | ○ | — | FK → `currency.id` ON DELETE SET NULL |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス（複合含む）:

| 名称 | 対象列 |
|---|---|
| `session_user_kind_status_idx` | `(user_id, kind, status)` |
| `session_user_date_idx` | `(user_id, session_date)` |
| `session_room_idx` | `(room_id)` |
| `session_currency_idx` | `(currency_id)` |

CHECK 制約 `session_manual_completed_check`: `(source != 'manual') OR (status = 'completed')` — 手動入力セッションは必ず `completed` 状態であること（ライブのみ active/paused を取り得る）を保証する。

リレーション: `game_session` 多 — 1 `user` / `room` / `currency`、1 — 多 `currency_transaction`（`transactions`）、多 — 多 `session_tag`（`tagLinks` 経由）。`session_cash_detail` / `session_tournament_detail` / `session_blind_level` / `session_chip_purchase` / `session_event` は `game_session` を FK 参照する子テーブルだが、`gameSessionRelations` 上には `transactions` と `tagLinks` のみが宣言されている。

#### セッション付随テーブル（1対1スナップショット / 子レコード）

`session_cash_detail` と `session_tournament_detail` はテンプレート（`ring_game` / `tournament`）から作成時にコピーした**スナップショット**を保持する。コメント記載のとおり親テンプレートのリネーム・設定変更は伝播せず凍結される。両者とも `session_id` を主キー兼 FK とする 1対1 拡張テーブル。

##### `session_cash_detail`（物理名 `session_cash_detail` / `schema/session-cash-detail.ts`） — キャッシュセッションの収支とルールスナップショット

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `sessionId` (`session_id`) | text | × | — | PRIMARY KEY 兼 FK → `game_session.id` ON DELETE CASCADE |
| `ringGameId` (`ring_game_id`) | text | ○ | — | FK → `ring_game.id` ON DELETE SET NULL |
| `buyIn` (`buy_in`) | integer | ○ | — | |
| `cashOut` (`cash_out`) | integer | ○ | — | |
| `evCashOut` (`ev_cash_out`) | integer | ○ | — | EV ベースのキャッシュアウト |
| `ruleName` (`rule_name`) | text | × | `"Untitled"` | スナップショット |
| `variant` | text | × | `"nlh"` | スナップショット |
| `blind1` | integer | ○ | — | スナップショット |
| `blind2` | integer | ○ | — | スナップショット |
| `blind3` | integer | ○ | — | スナップショット |
| `ante` | integer | ○ | — | スナップショット |
| `anteType` (`ante_type`) | text | ○ | — | スナップショット |
| `minBuyIn` (`min_buy_in`) | integer | ○ | — | スナップショット |
| `maxBuyIn` (`max_buy_in`) | integer | ○ | — | スナップショット |
| `tableSize` (`table_size`) | integer | ○ | — | スナップショット |

インデックス: `session_cash_ring_idx (ring_game_id)`。リレーション: `session_cash_detail` 1 — 1 `game_session`、多 — 1 `ring_game`。

##### `session_tournament_detail`（物理名 `session_tournament_detail` / `schema/session-tournament-detail.ts`） — トーナメントセッションの結果とルールスナップショット

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `sessionId` (`session_id`) | text | × | — | PRIMARY KEY 兼 FK → `game_session.id` ON DELETE CASCADE |
| `tournamentId` (`tournament_id`) | text | ○ | — | FK → `tournament.id` ON DELETE SET NULL |
| `tournamentBuyIn` (`tournament_buy_in`) | integer | ○ | — | |
| `entryFee` (`entry_fee`) | integer | ○ | — | |
| `placement` | integer | ○ | — | 着順 |
| `totalEntries` (`total_entries`) | integer | ○ | — | 総エントリー数 |
| `beforeDeadline` (`before_deadline`) | boolean | ○ | — | 締切前リタイアか |
| `prizeMoney` (`prize_money`) | integer | ○ | — | |
| `bountyPrizes` (`bounty_prizes`) | integer | ○ | — | |
| `timerStartedAt` (`timer_started_at`) | timestamp | ○ | — | |
| `ruleName` (`rule_name`) | text | × | `"Untitled"` | スナップショット |
| `variant` | text | × | `"nlh"` | スナップショット |
| `startingStack` (`starting_stack`) | integer | ○ | — | スナップショット |
| `bountyAmount` (`bounty_amount`) | integer | ○ | — | スナップショット |
| `tableSize` (`table_size`) | integer | ○ | — | スナップショット |

インデックス: `session_tournament_tournament_idx (tournament_id)`。リレーション: `session_tournament_detail` 1 — 1 `game_session`、多 — 1 `tournament`。

##### `session_blind_level`（物理名 `session_blind_level` / `schema/session-blind-level.ts`） — セッションに凍結されたブラインドストラクチャ

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `sessionId` (`session_id`) | text | × | — | FK → `game_session.id` ON DELETE CASCADE |
| `level` | integer | × | — | |
| `isBreak` (`is_break`) | boolean | × | `false` | |
| `blind1` | integer | ○ | — | |
| `blind2` | integer | ○ | — | |
| `blind3` | integer | ○ | — | |
| `ante` | integer | ○ | — | |
| `minutes` | integer | ○ | — | |

インデックス: `session_blind_level_session_idx (session_id)`。リレーション: 多 — 1 `game_session`。`tournament.blind_level` と同形のセッション側スナップショット。

##### `session_chip_purchase`（物理名 `session_chip_purchase` / `schema/session-chip-purchase.ts`） — セッションに凍結されたチップ購入ルール定義

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `sessionId` (`session_id`) | text | × | — | FK → `game_session.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `cost` | integer | × | — | |
| `chips` | integer | × | — | |
| `sortOrder` (`sort_order`) | integer | × | `0` | |

インデックス: `session_chip_purchase_session_idx (session_id)`。リレーション: 多 — 1 `game_session`。

##### `session_chip_purchase_result`（物理名 `session_chip_purchase_result` / `schema/session-chip-purchase-result.ts`） — チップ購入ルールごとの実際の購入回数

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `sessionChipPurchaseId` (`session_chip_purchase_id`) | text | × | — | PRIMARY KEY 兼 FK → `session_chip_purchase.id` ON DELETE CASCADE |
| `count` | integer | × | `0` | 購入回数 |

`session_chip_purchase` と 1対1（FK が主キーを兼ねる）。設計コメントより、コストは読み取り時に紐付く `session_chip_purchase.cost` から導出し、ここには重複保持しない。リレーション: 1 — 1 `session_chip_purchase`。

##### `session_event`（物理名 `session_event` / `schema/session-event.ts`） — ライブセッションのイベントストリーム（イベントソーシング）

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `sessionId` (`session_id`) | text | × | — | FK → `game_session.id` ON DELETE CASCADE |
| `eventType` (`event_type`) | text | × | — | 値域は `ALL_EVENT_TYPES`（下記） |
| `occurredAt` (`occurred_at`) | timestamp | × | — | イベント発生時刻 |
| `sortOrder` (`sort_order`) | integer | × | — | 同時刻内の順序 |
| `payload` | text | × | — | イベント種別ごとの JSON ペイロード（文字列保存） |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |
| `updatedAt` (`updated_at`) | timestamp | × | — | `$onUpdate` |

インデックス: `sessionEvent_sessionId_idx (session_id)`, `sessionEvent_eventType_idx (event_type)`。リレーション: 多 — 1 `game_session`。`session.status` はこのイベント列から導出可能（`getSessionCurrentState`：`session_end` あり→ `completed`、最新の状態イベントが `session_pause`→ `paused`、それ以外→ `active`）。

#### セッションタグ

##### `session_tag`（物理名 `session_tag` / `schema/session-tag.ts`） — セッション分類タグ（ユーザースコープ）

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `name` | text | × | — | |
| `createdAt` (`created_at`) | timestamp | × | `unixepoch()` | |

インデックス: `sessionTag_userId_idx (user_id)`。

##### `session_to_session_tag`（物理名 `session_to_session_tag` / `schema/session-tag.ts`） — セッション↔タグの多対多中間テーブル

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `sessionId` (`session_id`) | text | × | — | FK → `game_session.id` ON DELETE CASCADE / 複合 PK |
| `sessionTagId` (`session_tag_id`) | text | × | — | FK → `session_tag.id` ON DELETE CASCADE / 複合 PK |

複合主キー: `(session_id, session_tag_id)`。リレーション: `game_session` 多 — 多 `session_tag`（`game_session.tagLinks` / `session_tag.sessionLinks`、中間行は両側の 1 を逆参照）。`player` のタグ付け（`player_to_player_tag`）と異なり `position` 列は持たない。

#### その他

##### `update_note_view`（物理名 `update_note_view` / `schema/update-note-view.ts`） — リリースノート（更新通知）既読管理

| カラム | 型 | NULL | デフォルト | 制約・FK |
|---|---|---|---|---|
| `id` | text | × | — | PRIMARY KEY |
| `userId` (`user_id`) | text | × | — | FK → `user.id` ON DELETE CASCADE |
| `version` | text | × | — | 既読対象バージョン |
| `viewedAt` (`viewed_at`) | timestamp | × | `unixepoch()` | 既読日時 |

インデックス: `update_note_view_user_id_idx (user_id)`、UNIQUE インデックス `update_note_view_user_version_idx (user_id, version)`（1ユーザー1バージョンにつき1既読行）。リレーション: 多 — 1 `user`。

#### 列挙値・定数

##### ゲーム種別 / 取引種別（`constants.ts`）

| 定数 | 値 |
|---|---|
| `GAME_VARIANTS` キー | `nlh`（ラベル `NL Hold'em`、ブラインドラベル `blind1=SB / blind2=BB / blind3=Straddle`）。`variant` 列のデフォルトは全テーブル `"nlh"` |
| `DEFAULT_TRANSACTION_TYPES` | `"Purchase"`, `"Bonus"`, `"Session Result"`, `"Other"` |

##### セッションステータス（`constants/session-event-types.ts`）

`SESSION_STATUSES` = `active`, `paused`, `completed`（`game_session.status` の値域）。

##### セッションイベント種別（`constants/session-event-types.ts`）

`event_type` の値域はカテゴリ別に定義され、`ALL_EVENT_TYPES` がそれらの合成:

| カテゴリ定数 | イベント種別 | 備考 |
|---|---|---|
| `LIFECYCLE_EVENT_TYPES` | `session_start`, `session_end` | `MANUAL_CREATE_BLOCKED_EVENT_TYPES`（手動作成不可、ライフサイクルで自動生成） |
| `PAUSE_RESUME_EVENT_TYPES` | `session_pause`, `session_resume` | |
| `CASH_EVENT_TYPES` | `chips_add_remove`, `all_in` | キャッシュセッション専用 |
| `TOURNAMENT_EVENT_TYPES` | `purchase_chips` | トーナメント専用 |
| `COMMON_EVENT_TYPES` | `update_stack`, `player_join`, `player_leave`, `memo` | 両種別共通 |

ペイロード（`payload` 列の JSON）は種別ごとに Zod スキーマで検証される（主な制約値）:

| イベント種別 | ペイロード主要フィールドと制約 |
|---|---|
| `session_start`（cash） | `buyInAmount: int ≥ 0` |
| `session_start`（tournament） | `timerStartedAt: int | null` 任意 |
| `session_end`（cash） | `cashOutAmount: int ≥ 0` |
| `session_end`（tournament） | `beforeDeadline` で判別する discriminated union：`false` 時 `placement ≥ 1` / `totalEntries ≥ 1` / `prizeMoney ≥ 0` / `bountyPrizes ≥ 0`、`true` 時 `prizeMoney ≥ 0` / `bountyPrizes ≥ 0` |
| `session_pause` / `session_resume` | 空オブジェクト `{}` |
| `chips_add_remove` | `amount: int`（**非ゼロ**必須。正=チップ追加、負=早期キャッシュアウト） |
| `all_in` | `potSize ≥ 0`, `trials: int ≥ 1`, `equity: 0–100`, `wins ≥ 0` |
| `purchase_chips` | `sessionChipPurchaseId: 非空文字列`, `name: 非空`, `cost: int ≥ 0`, `chips: int ≥ 0`（ルール変更に備えた非正規化スナップショット） |
| `update_stack` | `stackAmount: int ≥ 0`、任意で `remainingPlayers: int ≥ 1`, `totalEntries: int ≥ 1`, `chipPurchaseCounts[]`（cash/tournament 共有。`averageStack` は読み取り時導出で非保存） |
| `player_join` | `playerId` 任意, `isHero: bool=false`, `seatPosition: int 0–8` 任意 |
| `player_leave` | `playerId` 任意, `isHero: bool=false` |
| `memo` | `text: 非空文字列` |

状態遷移制約（`isEventAllowedInState`）: `completed` では全イベント不可。`paused` では `memo` / `session_resume` / `session_end` のみ可。`active` ではキャッシュ / トーナメント / 共通の各イベントと `session_pause` / `session_end` が可。

##### タグカラー（`constants/player-tag-colors.ts`）

`TAG_COLOR_NAMES` = `gray`（`player_tag.color` のデフォルト）, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`。`TAG_COLORS` はこれらに表示用クラスを対応付けるが、DB に保存されるのは色名文字列のみ。

#### エンティティ関係の全体像

- **`user` がほぼ全データの所有者**で、`session`（認証）・`account`・`room`・`currency`・`transaction_type`・`player`・`player_tag`・`session_tag`・`game_session`・`update_note_view` を直接 `user_id` で所有し、ユーザー削除時に CASCADE で全配下が連鎖削除される。
- **マスタ → テンプレート → セッション** の3層構造:
  - `room` は `ring_game`（キャッシュルール、CASCADE）と `tournament`（トーナメントルール、CASCADE）を保持。`currency` は両テンプレートおよび `game_session` から SET NULL で参照される（通貨削除でルール / セッションは残る）。
  - `tournament` はその配下に `blind_level`・`tournament_chip_purchase`・`tournament_tag` を CASCADE で持つ。
  - `game_session` がプレイ実体。`kind`（cash_game / tournament）と `source`（manual / live）で挙動が分岐し、`source='manual'` は `status='completed'` を CHECK 制約で強制。`room` / `currency` は SET NULL 参照。
- **`game_session` の拡張・子テーブル**（いずれも `session_id` 経由 CASCADE）:
  - 1対1: `session_cash_detail` / `session_tournament_detail`（テンプレートからの凍結スナップショット + 収支結果）。
  - 1対多: `session_blind_level`・`session_chip_purchase`・`session_event`。`session_chip_purchase` はさらに 1対1 で `session_chip_purchase_result`（購入回数）を持つ。
  - `session_event` はライブセッションのイベントソーシング基盤で、`status` の真実はイベント列から導出される。
- **多対多 2系統**（中間テーブル + 複合主キー、両側 CASCADE）: `player ↔ player_tag`（`player_to_player_tag`、`position` 付き）、`game_session ↔ session_tag`（`session_to_session_tag`、順序なし）。
- **金銭フロー**: `currency_transaction` が `currency`（CASCADE）・`transaction_type`（onDelete 未指定）・`game_session`（任意・CASCADE）を参照し、セッション結果の収支を通貨残高へ反映する横断テーブル。
- **認証系** `user / session / account / verification` は Better Auth 標準構成で、`session`・`account` が `user` に CASCADE 従属、`verification` は独立（リレーション定義なし）。

ファイルパス参照: スキーマ定義は `/home/user/sapphire2/packages/db/src/schema/`、集約は `/home/user/sapphire2/packages/db/src/schema.ts`、定数は `/home/user/sapphire2/packages/db/src/constants.ts` と `/home/user/sapphire2/packages/db/src/constants/`（`session-event-types.ts` / `player-tag-colors.ts`）。

## 5. 認証・認可

### 概要

認証基盤は **Better Auth**（`packages/auth/src/index.ts` の `createAuth()`）で構成され、Cloudflare Workers 上の Hono サーバ（`apps/server/src/worker.ts`）にマウントされる。永続化は Drizzle ORM + Cloudflare D1（SQLite）で、認証用テーブルは `packages/db/src/schema/auth.ts` に定義される。API 層（tRPC v11）は `protectedProcedure` で認可を強制し、各リソースは `userId` によって所有者単位にスコープされる。

### 対応する認証方式

`createAuth()` は以下を有効化する。ソーシャルプロバイダは対応する Client ID / Secret の両方が env に存在する場合のみ条件付きで登録される（`...(options.googleClientId && options.googleClientSecret && { ... })`）。

| 方式 | 有効化条件 | 設定内容 |
|---|---|---|
| メール / パスワード | 常に有効（`emailAndPassword.enabled: true`） | パスワードハッシュは独自実装に差し替え |
| Google OAuth | `GOOGLE_CLIENT_ID` と `GOOGLE_CLIENT_SECRET` が両方設定済みのとき | `socialProviders.google` に `clientId` / `clientSecret` を渡す |
| Discord OAuth | `DISCORD_CLIENT_ID` と `DISCORD_CLIENT_SECRET` が両方設定済みのとき | `socialProviders.discord` に `clientId` / `clientSecret` を渡す |

#### パスワードハッシュ（独自実装）

Better Auth の既定ハッシュではなく、Web Crypto API ベースの PBKDF2 を `password.hash` / `password.verify` に注入している（Cloudflare Workers ランタイム互換のため）。

| 項目 | 値 |
|---|---|
| アルゴリズム | PBKDF2 |
| ハッシュ関数 | SHA-256 |
| イテレーション回数 | 100,000 |
| ソルト長 | 16 バイト（`crypto.getRandomValues`） |
| 派生ビット長 | 256 bit |
| 保存形式 | `<saltHex>:<hashHex>`（16進エンコードしたソルトとハッシュをコロン連結） |
| 検証 | 保存値を `:` で分割し、同一ソルト・同一パラメータで再導出した16進文字列と厳密一致比較 |

#### アカウントリンク

`account.accountLinking.enabled: true`、`trustedProviders: ["google", "discord", "credential"]`。これら 3 プロバイダ経由のサインインは同一ユーザへのリンクが許可される。

### サーバ側エンドポイントとハンドラ

Hono 上で Better Auth は 3 系統で呼び出される。すべての呼び出しで `createDb(c.env.DB)` と `createAuth(db, {...})` をリクエストごとにインスタンス化する（Workers のリクエストスコープモデルに合わせるため）。

| ルート / メソッド | 内容 |
|---|---|
| `POST /api/auth/set-password` | `auth.api.setPassword()` を明示的に呼び出す専用ハンドラ。リクエストヘッダ（セッション）と JSON ボディを渡す |
| `POST` / `GET` `/api/auth/*` | Better Auth の汎用ハンドラ `auth.handler(c.req.raw)` に委譲（サインイン / サインアウト / OAuth コールバック / セッション取得など） |
| `/trpc/*` | tRPC ミドルウェア。`createContextFactory(auth, db, ANTHROPIC_API_KEY)` でコンテキストを生成 |
| `GET /` | `"OK"` を返すヘルスチェック |

### セッション管理

セッションは `session` テーブル（D1）に永続化され、Cookie で受け渡される。

#### Cookie 属性（`advanced.defaultCookieAttributes`）

| 属性 | 値 | 意味 |
|---|---|---|
| `sameSite` | `"none"` | クロスサイト（別オリジンの SPA → API）で Cookie を送出するため |
| `secure` | `true` | HTTPS 経由のみ送出 |
| `httpOnly` | `true` | JavaScript からの Cookie 読み取りを禁止 |

`sameSite: "none"` + `secure: true` の組み合わせは、Web（`CORS_ORIGIN`）と API が別オリジンで動作する構成を前提としている。

#### `session` テーブル（`packages/db/src/schema/auth.ts`）

| カラム | 型 | 制約 |
|---|---|---|
| `id` | text | PK |
| `expiresAt` | integer (timestamp) | NOT NULL（有効期限。具体値は Better Auth の既定に従い、設定でのオーバーライドはなし） |
| `token` | text | NOT NULL, UNIQUE |
| `createdAt` | integer (timestamp) | NOT NULL, default `unixepoch()` |
| `updatedAt` | integer (timestamp) | NOT NULL, `$onUpdate` で更新 |
| `ipAddress` | text | nullable |
| `userAgent` | text | nullable |
| `userId` | text | NOT NULL, `user.id` 参照, `onDelete: cascade` |

`session_userId_idx`（`userId` のインデックス）を持ち、ユーザ削除時にセッションはカスケード削除される。セッション有効期限・更新間隔は `createAuth()` で明示設定していないため、Better Auth の既定値が適用される。

#### 関連テーブル

| テーブル | 役割 | 主なカラム |
|---|---|---|
| `user` | ユーザ本体 | `id`(PK), `name`(NOT NULL), `email`(NOT NULL, UNIQUE), `emailVerified`(default `false`), `image`(nullable), `createdAt`, `updatedAt` |
| `account` | プロバイダ別資格情報 | `accountId`, `providerId`, `userId`(cascade), `accessToken`/`refreshToken`/`idToken`(nullable), `scope`, `password`(メール/パスワードのハッシュ格納先, nullable), 各種期限。`account_userId_idx` |
| `verification` | 検証トークン | `identifier`, `value`, `expiresAt`(NOT NULL)。`verification_identifier_idx` |

### tRPC コンテキストと認可

#### コンテキスト生成（`packages/api/src/context.ts`）

`createContextFactory` が返すファクトリは、各 tRPC リクエストで `authInstance.api.getSession({ headers: context.req.raw.headers })` を呼び、Cookie からセッションを解決する。コンテキストの形は次の 3 フィールド。

| フィールド | 型 / 内容 |
|---|---|
| `session` | `getSession()` の戻り値（認証済みなら `{ session, user }`、未認証なら `null`） |
| `db` | D1 Drizzle インスタンス |
| `anthropicApiKey` | `ANTHROPIC_API_KEY`（任意。AI 抽出機能でのみ使用） |

#### `publicProcedure` と `protectedProcedure`（`packages/api/src/index.ts`）

- `publicProcedure = t.procedure`：認可チェックなし。実際に公開されているのはルートの `healthCheck` のみ。
- `protectedProcedure`：ミドルウェアで `ctx.session` の有無を検査する。

```ts
if (!ctx.session) {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Authentication required",
    cause: "No session",
  });
}
```

未認証時は `TRPCError` の `code: "UNAUTHORIZED"`（HTTP 401 相当）を投げる。通過時は `next()` に `session` を含むコンテキストを再構成して渡し、以降の `ctx.session` は非 null として型付けされる。下流のプロシージャは `ctx.session.user.id` でユーザ ID を取得する。

ルートには `healthCheck`（public）と `privateData`（protected、`ctx.session.user` を返すサンプル）も定義されている。`healthCheck` を除き、全 20 ルータの全プロシージャ（`protectedProcedure` の使用は 18 ルータ・計 137 箇所）が protected である。

### 認可（所有権スコープ）

リソース操作は「未認証排除（`protectedProcedure`）」と「所有者検証（`userId` 一致）」の二段で守られる。各ルータの定型は以下のとおり（`player` ルータが代表例）。

1. `const userId = ctx.session.user.id;` を取得。
2. 一覧取得（`list`）は `eq(table.userId, userId)` を WHERE 条件に必ず含め、他ユーザのレコードを返さない。
3. 単一取得・更新・削除（`getById` / `update` / `delete`）は、まず ID でレコードを引き、

| 状況 | 投げる `TRPCError` |
|---|---|
| レコードが存在しない | `code: "NOT_FOUND"`（例: `"Player not found"`） |
| 存在するが `found.userId !== userId` | `code: "FORBIDDEN"`（例: `"You do not own this player"`） |

4. 作成（`create`）は `userId` を必ず `ctx.session.user.id` で埋め、クライアント入力からは受け取らない。

`NOT_FOUND` を `FORBIDDEN` より先に判定するため、存在しない ID と他人の ID は応答メッセージで区別され得る。

#### `userId` を直接保持する（所有権ルート）テーブル

DB スキーマ上、`user.id` を直接参照し `onDelete: cascade` を持つ「所有権の起点」テーブルは次のとおり。これら以外の子テーブル（ブラインドレベル、リングゲーム、トーナメント、セッションイベント、卓上プレイヤー、各種トランザクション、チップ購入など）は親レコード経由で間接的に所有者にスコープされる。

| テーブル | スキーマファイル | 所有 |
|---|---|---|
| `room` | `schema/room.ts` | `userId` NOT NULL → `user.id`, cascade |
| `currency` | `schema/currency.ts` | 同上 |
| `transactionType` | `schema/currency.ts` | 同上 |
| `player` | `schema/player.ts` | 同上 |
| `playerTag` | `schema/player.ts` | 同上 |
| `gameSession` | `schema/session.ts` | 同上 |
| `sessionTag` | `schema/session-tag.ts` | 同上 |
| `updateNoteView` | `schema/update-note-view.ts` | 同上 |

いずれもユーザ削除時にカスケード削除される。すなわちユーザのデータは完全に当該ユーザにスコープされ、アカウント削除で関連レコードが連鎖的に消える設計である。

### CORS / trustedOrigins / credentials

#### CORS（Hono、`apps/server/src/worker.ts`）

全パス（`/*`）に適用されるミドルウェア。

| 設定 | 値 |
|---|---|
| `origin` | `c.env.CORS_ORIGIN`（単一オリジン文字列） |
| `allowMethods` | `["GET", "POST", "OPTIONS"]` |
| `allowHeaders` | `["Content-Type", "Authorization"]` |
| `credentials` | `true`（Cookie ベースのクロスオリジン認証を許可） |

#### trustedOrigins（Better Auth）

`createAuth()` に `trustedOrigins: [options.corsOrigin]` を渡す。すなわち Better Auth が信頼するオリジンも `CORS_ORIGIN` の単一値に一致させており、CORS 許可オリジンと OAuth/認証の信頼オリジンが同一に保たれる。

`credentials: true`（CORS）と Cookie の `sameSite: "none"` + `secure: true` が連動し、Web（`CORS_ORIGIN`）と API が別オリジンでも認証 Cookie を双方向に流せる構成になっている。

### 認証関連の環境変数

サーバ（`apps/server`）の認証関連 env（`Env` インターフェース / `.dev.vars.example`）。

| 変数 | 必須 | 用途 | ローカル例 |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | 必須 | Better Auth の署名シークレット（32文字以上） | `your-secret-at-least-32-characters-long` |
| `BETTER_AUTH_URL` | 必須 | 認証のベース URL（`createAuth` の `baseURL`） | `http://localhost:8787` |
| `CORS_ORIGIN` | 必須 | CORS 許可オリジン兼 `trustedOrigins` | `http://localhost:3001` |
| `GOOGLE_CLIENT_ID` | 任意 | Google OAuth（未設定なら Google 無効） | `your-google-client-id` |
| `GOOGLE_CLIENT_SECRET` | 任意 | Google OAuth | `your-google-client-secret` |
| `DISCORD_CLIENT_ID` | 任意 | Discord OAuth（未設定なら Discord 無効） | `your-discord-client-id` |
| `DISCORD_CLIENT_SECRET` | 任意 | Discord OAuth | `your-discord-client-secret` |
| `ANTHROPIC_API_KEY` | 任意 | AI 抽出機能用（認証そのものには不使用） | `your-anthropic-api-key` |
| `DB` | 必須 | Cloudflare D1 バインディング（認証データ永続化先） | — |

Web 側（`packages/env/src/web.ts`、`VITE_` プレフィックス）の認証関連 env。

| 変数 | 必須 | 用途 |
|---|---|---|
| `VITE_SERVER_URL` | 必須（URL 検証あり） | 認証 / API リクエスト先サーバ URL |
| `VITE_PREVIEW_AUTO_LOGIN` | 任意 | プレビュー環境での自動ログイン有効化フラグ |
| `VITE_PREVIEW_LOGIN_EMAIL` | 任意 | プレビュー自動ログインのメール |
| `VITE_PREVIEW_LOGIN_PASSWORD` | 任意 | プレビュー自動ログインのパスワード |

(関連ファイル: `/home/user/sapphire2/packages/auth/src/index.ts`, `/home/user/sapphire2/packages/db/src/schema/auth.ts`, `/home/user/sapphire2/packages/api/src/index.ts`, `/home/user/sapphire2/packages/api/src/context.ts`, `/home/user/sapphire2/apps/server/src/worker.ts`, `/home/user/sapphire2/apps/server/.dev.vars.example`, `/home/user/sapphire2/packages/env/src/web.ts`, `/home/user/sapphire2/packages/api/src/routers/player.ts`)

## 6. API仕様 - エンティティ管理

### 概要

エンティティ管理ルーターは、ユーザーが所有するマスターデータ（ルーム、通貨、トランザクション種別、通貨取引、プレイヤー、プレイヤータグ、セッションタグ、リングゲーム）の CRUD を担う。すべてのプロシージャは `protectedProcedure` で定義され、認証セッションが必須である。全プロシージャに共通する基本パターンは以下のとおり。

- **所有者スコープ**: 一覧系は `WHERE user_id = ctx.session.user.id` で絞り込む。単一レコード操作系は対象を取得後、`found.userId !== userId`（リングゲームのみルーム経由）なら `FORBIDDEN` を投げる。
- **存在チェック**: 対象が見つからなければ `NOT_FOUND`、見つかっても所有者でなければ `FORBIDDEN`。
- **ID 生成**: 作成時は `crypto.randomUUID()` でサーバ側採番。クライアントは ID を指定しない。
- **戻り値**: 作成・更新系は変更後の行を `SELECT` で再取得して返す。削除系は `{ success: true }` を返す。
- **更新の部分適用**: 更新系入力は `id` 以外を任意とし、`undefined`（キー省略）は「変更なし」、`null`（明示指定可能なフィールドのみ）は「クリア」を意味する。`...(input.x === undefined ? {} : { x: input.x })` のパターンで `undefined` のフィールドを `set` から除外する。
- `updatedAt` はスキーマ側 `$onUpdate` で自動更新されるが、ルームや通貨など多くの更新系は明示的に `updatedAt: new Date()` も設定する。

エラーコードと意味:

| TRPC コード | 発生条件 |
|---|---|
| `NOT_FOUND` | 指定 ID のレコードが存在しない |
| `FORBIDDEN` | レコードは存在するが所有者が異なる／セッション生成取引の編集・削除を試みた |
| `PRECONDITION_FAILED` | 使用中のトランザクション種別を削除しようとした |

---

### room ルーター（`room.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `list` | query | protected |
| `getById` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `delete` | mutation | protected |
| `toggleFavorite` | mutation | protected |

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `list` | （なし） | — | — | — |
| `getById` | `id` | string | 必須 | — |
| `create` | `name` | string | 必須 | `min(1)` |
| `create` | `memo` | string | 任意 | — |
| `update` | `id` | string | 必須 | — |
| `update` | `name` | string | 任意 | `min(1)` |
| `update` | `memo` | string \| null | 任意 | `nullable`（`null` で memo クリア） |
| `delete` | `id` | string | 必須 | — |
| `toggleFavorite` | `id` | string | 必須 | — |

**戻り値・副作用・並び順**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ |
|---|---|---|---|
| `list` | ルーム配列。各行に `ringGameCount` / `tournamentCount`（相関サブクエリで `archived_at IS NULL` の非アーカイブ件数）を付与 | なし | `WHERE user_id`、`ORDER BY isFavorite DESC, createdAt ASC` |
| `getById` | ルーム1行（全列） | なし | — |
| `create` | 作成行 | `room` に1行 INSERT（`memo` 未指定は `null`） | — |
| `update` | 更新後の行 | `room` を UPDATE（`name`/`memo` を部分適用、`updatedAt` 設定） | — |
| `delete` | `{ success: true }` | `room` を DELETE。`ring_game.roomId` / `tournament.roomId` は `onDelete: cascade` で連鎖削除 | — |
| `toggleFavorite` | 更新後の行 | `isFavorite` を反転して UPDATE | — |

---

### currency ルーター（`currency.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `list` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `delete` | mutation | protected |
| `toggleFavorite` | mutation | protected |

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `list` | （なし） | — | — | — |
| `create` | `name` | string | 必須 | `min(1)` |
| `create` | `unit` | string | 任意 | `max(4)`、正規表現 `/^[\x20-\x7e]*$/`（印字可能 ASCII のみ） |
| `create` | `description` | string \| null | 任意 | `max(50000)`、`nullable`（リッチテキストの sanitized HTML） |
| `update` | `id` | string | 必須 | — |
| `update` | `name` | string | 任意 | `min(1)` |
| `update` | `unit` | string \| null | 任意 | `max(4)`、正規表現 `/^[\x20-\x7e]*$/`、`nullable`（`null` で unit クリア） |
| `update` | `description` | string \| null | 任意 | `max(50000)`、`nullable` |
| `delete` | `id` | string | 必須 | — |
| `toggleFavorite` | `id` | string | 必須 | — |

**戻り値・副作用・並び順**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ |
|---|---|---|---|
| `list` | 通貨配列。各行に `balance`（`COALESCE(SUM(currencyTransaction.amount), 0)` を `currencyTransaction` の LEFT JOIN + `GROUP BY currency.id` で算出した残高）を付与 | なし | `WHERE user_id`、`ORDER BY isFavorite DESC, createdAt ASC` |
| `create` | 作成行 | `currency` に1行 INSERT（`unit`/`description` 未指定は `null`） | — |
| `update` | 更新後の行 | `currency` を UPDATE（`name`/`unit`/`description` を部分適用） | — |
| `delete` | `{ success: true }` | `currency` を DELETE。`currency_transaction.currencyId` は `onDelete: cascade` で連鎖削除。`ring_game.currencyId` は `onDelete: set null`。削除前のチェックはなし | — |
| `toggleFavorite` | 更新後の行 | `isFavorite` を反転して UPDATE | — |

---

### transaction-type ルーター（`transaction-type.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `list` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `delete` | mutation | protected |

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `list` | （なし） | — | — | — |
| `create` | `name` | string | 必須 | `min(1)` |
| `update` | `id` | string | 必須 | — |
| `update` | `name` | string | 必須 | `min(1)` |
| `delete` | `id` | string | 必須 | — |

**戻り値・副作用・並び順**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ |
|---|---|---|---|
| `list` | トランザクション種別の配列（全列） | **遅延シード**: ユーザーの種別が0件の場合、`DEFAULT_TRANSACTION_TYPES`（`"Purchase"`, `"Bonus"`, `"Session Result"`, `"Other"` の4件）を INSERT してから返す | `WHERE user_id`（明示的な `ORDER BY` なし） |
| `create` | 作成行 | `transaction_type` に1行 INSERT | — |
| `update` | 更新後の行 | `transaction_type` の `name` を UPDATE | — |
| `delete` | `{ success: true }` | 削除前に `currency_transaction.transactionTypeId = id` を持つ取引が存在するか確認。**使用中なら `PRECONDITION_FAILED`（"Cannot delete: type is in use by transactions"）を投げて削除を拒否**。未使用なら DELETE。`currencyTransaction.transactionTypeId` の FK にカスケード指定はない | — |

---

### currency-transaction ルーター（`currency-transaction.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `listByCurrency` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `delete` | mutation | protected |

`PAGE_SIZE = 10`。`listByCurrency` のみ `_pagination.ts` の `paginate` を用いたカーソルページネーションを行う。

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `listByCurrency` | `currencyId` | string | 必須 | — |
| `listByCurrency` | `cursor` | string | 任意 | 前ページ最終行の `id`（カーソル） |
| `create` | `currencyId` | string | 必須 | — |
| `create` | `transactionTypeId` | string | 必須 | — |
| `create` | `amount` | number | 必須 | `int()`（整数、符号制約なし＝正負両方可） |
| `create` | `transactedAt` | string | 必須 | ISO 文字列（サーバで `new Date(...)` に変換） |
| `create` | `memo` | string | 任意 | — |
| `update` | `id` | string | 必須 | — |
| `update` | `transactionTypeId` | string | 任意 | — |
| `update` | `amount` | number | 任意 | `int()` |
| `update` | `transactedAt` | string | 任意 | ISO 文字列 |
| `update` | `memo` | string \| null | 任意 | `nullable`（`null` で memo クリア） |
| `delete` | `id` | string | 必須 | — |

**戻り値・副作用・並び順・ページネーション**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ/ページネーション |
|---|---|---|---|
| `listByCurrency` | `{ items, nextCursor }`。各 item は `id`, `currencyId`, `transactionTypeId`, `transactionTypeName`（`transaction_type` INNER JOIN）, `sessionId`, `sessionName`（`gameSession.kind` に応じて cash は `sessionCashDetail.ruleName`、tournament は `sessionTournamentDetail.ruleName`、それ以外 `NULL` を `CASE` で算出）, `amount`, `transactedAt`, `memo`, `createdAt`。所有権チェックを先に行い、非所有者は `FORBIDDEN` | なし | `WHERE currencyId = input.currencyId`。`cursor` 指定時は `(transactedAt, id) < (カーソル行の transacted_at, id)` のタプル比較で絞り込み。`ORDER BY transactedAt DESC, id DESC`、`LIMIT PAGE_SIZE + 1`（=11）。`paginate` で 10 件に切り詰め、11件目があれば `nextCursor` を最終 item の `id` に設定 |
| `create` | 作成行 | 親通貨の所有権を確認後、`currency_transaction` に1行 INSERT。`sessionId` は設定されない（手動取引のため `null`）。`memo` 未指定は `null` | — |
| `update` | 更新後の行 | 取引と親通貨を JOIN 取得し所有権確認。**`sessionId !== null`（セッション生成取引）の場合 `FORBIDDEN`（"Session-generated transactions cannot be edited. Edit the session instead."）で編集拒否**。`transactionTypeId`/`amount`/`transactedAt`/`memo` を部分適用 UPDATE | — |
| `delete` | `{ success: true }` | 所有権確認後、**`sessionId !== null` なら `FORBIDDEN`（"Session-generated transactions cannot be deleted. Delete the session instead."）で削除拒否**。手動取引のみ DELETE | — |

---

### player ルーター（`player.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `list` | query | protected |
| `getById` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `delete` | mutation | protected |

プレイヤーは多対多でプレイヤータグと関連付く（中間テーブル `player_to_player_tag`、`position` 列でタグの並び順を保持）。

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `list` | （入力オブジェクト自体）| object | 任意 | スキーマ全体が `.optional()` |
| `list` | `search` | string | 任意 | 部分一致検索（`LIKE %search%`、`name` 対象） |
| `list` | `tagIds` | string[] | 任意 | 指定タグのいずれかを持つプレイヤーに絞り込み |
| `getById` | `id` | string | 必須 | — |
| `create` | `name` | string | 必須 | `min(1).max(100)` |
| `create` | `memo` | string | 任意 | `max(50000)` |
| `create` | `tagIds` | string[] | 任意 | 付与するタグ ID（配列順が `position` になる） |
| `update` | `id` | string | 必須 | — |
| `update` | `name` | string | 任意 | `min(1).max(100)` |
| `update` | `memo` | string \| null | 任意 | `max(50000)`、`nullable` |
| `update` | `tagIds` | string[] | 任意 | 指定時はタグ関連を全置換 |
| `delete` | `id` | string | 必須 | — |

**戻り値・副作用・並び順・フィルタ**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ |
|---|---|---|---|
| `list` | プレイヤー配列。各要素に `tags`（`{ id, name, color }[]`、`position ASC` 順）を付与 | なし | `WHERE user_id AND isTemporary = false`。`search` 指定時 `name LIKE %search%`。`tagIds` 指定時は中間テーブルから該当 playerId を集約して `IN` 絞り込み（該当0件なら早期に空配列を返す）。テーブル自体の `ORDER BY` なし（タグのみ `position` 順） |
| `getById` | プレイヤー1行 + `tags`（`position ASC` 順） | なし | — |
| `create` | 作成行 + `tags` | `player` に1行 INSERT（`isTemporary` はデフォルト `false`、`memo` 未指定は `null`）。`tagIds` があれば `player_to_player_tag` に配列インデックスを `position` として一括 INSERT | — |
| `update` | 更新後の行 + `tags` | `player` の `name`/`memo` を部分適用 UPDATE。`tagIds !== undefined` の場合、既存のタグ関連を全 DELETE してから新 `tagIds` を `position` 付きで再 INSERT（全置換。空配列なら関連を消すのみ） | — |
| `delete` | `{ success: true }` | `player` を DELETE。`player_to_player_tag.playerId` は `onDelete: cascade` で連鎖削除 | — |

備考: `list`/`create`/`update`/`getById` のタグ取得は `player_to_player_tag` と `player_tag` を INNER JOIN し `position ASC` で整列。`list` は `isTemporary = false` のプレイヤーのみ返す（一時プレイヤーを除外）。

---

### player-tag ルーター（`player-tag.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `list` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `delete` | mutation | protected |

`color` は `z.enum(TAG_COLOR_NAMES)`。許容値は `"gray"`, `"red"`, `"orange"`, `"yellow"`, `"green"`, `"blue"`, `"purple"`, `"pink"` の8色。

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `list` | （なし） | — | — | — |
| `create` | `name` | string | 必須 | `min(1).max(50)` |
| `create` | `color` | enum | 任意 | 上記8色の enum、`default("gray")`（省略時 `"gray"`） |
| `update` | `id` | string | 必須 | — |
| `update` | `name` | string | 任意 | `min(1).max(50)` |
| `update` | `color` | enum | 任意 | 上記8色の enum |
| `delete` | `id` | string | 必須 | — |

**戻り値・副作用・並び順**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ |
|---|---|---|---|
| `list` | プレイヤータグ配列（全列） | なし | `WHERE user_id`（明示的 `ORDER BY` なし） |
| `create` | 作成行 | `player_tag` に1行 INSERT | — |
| `update` | 更新後の行 | `name`/`color` を部分適用 UPDATE | — |
| `delete` | `{ success: true }` | **先に `player_to_player_tag.playerTagId = id` の中間テーブル行を明示 DELETE**（FK の `onDelete: cascade` も設定されているが、ルーター側でも明示削除）してから `player_tag` を DELETE | — |

---

### session-tag ルーター（`session-tag.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `list` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `delete` | mutation | protected |

セッションタグは色を持たず `name` のみ。`player-tag` とほぼ同構造だが `color` フィールドはない。

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `list` | （なし） | — | — | — |
| `create` | `name` | string | 必須 | `min(1)` |
| `update` | `id` | string | 必須 | — |
| `update` | `name` | string | 必須 | `min(1)` |
| `delete` | `id` | string | 必須 | — |

**戻り値・副作用・並び順**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ |
|---|---|---|---|
| `list` | セッションタグ配列（全列） | なし | `WHERE user_id`（明示的 `ORDER BY` なし） |
| `create` | 作成行 | `session_tag` に1行 INSERT | — |
| `update` | 更新後の行 | `name` を UPDATE | — |
| `delete` | `{ success: true }` | 先に `session_to_session_tag.sessionTagId = id` の中間テーブル行を明示 DELETE してから `session_tag` を DELETE | — |

---

### ring-game ルーター（`ring-game.ts`）

| プロシージャ | 種別 | 認可 |
|---|---|---|
| `listByRoom` | query | protected |
| `create` | mutation | protected |
| `update` | mutation | protected |
| `archive` | mutation | protected |
| `restore` | mutation | protected |
| `delete` | mutation | protected |

所有権は2段階で検証する。`validateRoomOwnership`（ルームの存在＋所有者確認）と `validateRingGameOwnership`（リングゲームを取得し、`roomId` があればそのルームの所有権を確認）。リングゲームは `room` を所有者の起点とし、`roomId` が `null` の場合はルーム経由の所有者チェックをスキップする。アーカイブはソフトデリート（`archivedAt` タイムスタンプ）で表現する。

**入力スキーマ**

| プロシージャ | フィールド | 型 | 必須/任意 | 制約 |
|---|---|---|---|---|
| `listByRoom` | `roomId` | string | 必須 | — |
| `listByRoom` | `includeArchived` | boolean | 任意 | `true` でアーカイブ済みのみ、未指定/`false` で非アーカイブのみ |
| `create` | `roomId` | string | 必須 | — |
| `create` | `name` | string | 必須 | `min(1)` |
| `create` | `variant` | string | 任意 | `default("nlh")`（省略時 `"nlh"`） |
| `create` | `blind1` / `blind2` / `blind3` | number | 任意 | `int()` |
| `create` | `ante` | number | 任意 | `int()` |
| `create` | `anteType` | enum | 任意 | `"none"` / `"all"` / `"bb"` |
| `create` | `minBuyIn` / `maxBuyIn` | number | 任意 | `int()` |
| `create` | `tableSize` | number | 任意 | `int()` |
| `create` | `currencyId` | string | 任意 | — |
| `create` | `memo` | string | 任意 | — |
| `update` | `id` | string | 必須 | — |
| `update` | `name` | string | 任意 | `min(1)` |
| `update` | `variant` | string | 任意 | — |
| `update` | `blind1` / `blind2` / `blind3` | number \| null | 任意 | `int()`, `nullable` |
| `update` | `ante` | number \| null | 任意 | `int()`, `nullable` |
| `update` | `anteType` | enum \| null | 任意 | `"none"` / `"all"` / `"bb"`、`nullable` |
| `update` | `minBuyIn` / `maxBuyIn` | number \| null | 任意 | `int()`, `nullable` |
| `update` | `tableSize` | number \| null | 任意 | `int()`, `nullable` |
| `update` | `currencyId` | string \| null | 任意 | `nullable` |
| `update` | `memo` | string \| null | 任意 | `nullable` |
| `archive` / `restore` / `delete` | `id` | string | 必須 | — |

**戻り値・副作用・並び順・フィルタ**

| プロシージャ | 戻り値 | 副作用 | 並び順/フィルタ |
|---|---|---|---|
| `listByRoom` | リングゲーム配列（全列） | なし。先にルーム所有権を検証 | `WHERE roomId = input.roomId AND`（`includeArchived` が真なら `archivedAt IS NOT NULL`、偽なら `archivedAt IS NULL`）。明示的 `ORDER BY` なし |
| `create` | 作成行 | ルーム所有権検証後、`ring_game` に1行 INSERT。未指定の任意数値・enum・`currencyId`・`memo` はすべて `null`。`variant` 省略時は `"nlh"` | — |
| `update` | 更新後の行 | リングゲーム所有権検証後、`undefined` でない各フィールドのみを `set`（`null` 明示でクリア可能）し UPDATE。`updatedAt` は常に設定 | — |
| `archive` | 更新後の行 | `archivedAt = new Date()` を設定（ソフトデリート） | — |
| `restore` | 更新後の行 | `archivedAt = null` を設定（アーカイブ解除） | — |
| `delete` | `{ success: true }` | `ring_game` を物理 DELETE | — |

備考: `ring_game.roomId` は `onDelete: cascade`（ルーム削除で連鎖）、`ring_game.currencyId` は `onDelete: set null`（通貨削除で `null` 化）。`anteType` はルーターの Zod enum では `"none"/"all"/"bb"` に制約されるが、DB スキーマ上は単なる `text`（NULL 許容）。

---

### 共通ページネーション（`_pagination.ts`）

カーソルベースの "`pageSize + 1` 件取得して番兵を切り落とす" パターンを担う純関数 `paginate<T extends { id: string }>(rows, pageSize)`。

| 項目 | 内容 |
|---|---|
| シグネチャ | `paginate<T extends { id: string }>(rows: T[], pageSize: number): { items: T[]; nextCursor: string \| undefined }` |
| 入力 `rows` | DB から取得した最大 `pageSize + 1` 件（整列済み） |
| 入力 `pageSize` | 意図したページサイズ（本ルーター群では `currencyTransaction` が `PAGE_SIZE = 10`） |
| 判定 | `hasMore = rows.length > pageSize` |
| `items` | `hasMore` なら `rows.slice(0, pageSize)`、そうでなければ `rows` 全件 |
| `nextCursor` | `hasMore` なら `items.at(-1)?.id`（最終 item の `id`）、なければ `undefined` |

カーソル（`nextCursor`）は最終行の `id` 文字列。`currency-transaction` の `listByCurrency` では、次ページ取得時にこのカーソルを `(transactedAt, id)` のタプル比較に用いることで、ランダム UUID の `id` 単独比較で起こる行の取りこぼし・重複を回避し、`transactedAt DESC` の表示順とページングを一致させている。本ルーター群でこの関数を利用するのは `currency-transaction` のみで、他のエンティティ管理ルーターはページネーションを持たない。

## 7. API仕様 - トーナメント定義・セッション記録

### 概要

このセクションは、トーナメント定義（マスター構造）の管理、およびセッション記録（キャッシュ／トーナメント区別）の作成・更新・参照・削除を担う tRPC ルーター群を扱う。対象ルーターは `tournamentRouter`・`blindLevelRouter`・`tournamentChipPurchaseRouter`・`sessionRouter`・`sessionEventRouter`・`sessionTagRouter`、および時刻計算ユーティリティ `session-event-time.ts`。すべてのプロシージャは `protectedProcedure`（要認証）であり、未認証は `UNAUTHORIZED`。

データモデルの基本構造:

- **トーナメント定義**（`tournament`）は `room` に属し（`room_id` FK、`onDelete: cascade`）、再利用可能なマスター。子に**ブラインドレベル列**（`blind_level`）と**チップ購入定義**（`tournament_chip_purchase`）を持つ（いずれも `tournament_id` FK、`onDelete: cascade`）。
- **セッション**（`gameSession` = `game_session`）は `kind`（`cash_game` / `tournament`）で区別され、種別に応じて 1:1 の詳細行（`session_cash_detail` / `session_tournament_detail`）を持つ。セッションはマスター（`ringGame` / `tournament`）を参照しつつ、ルール内容を作成時点のスナップショットとして詳細行へ凍結する。
- **ライブセッション**（`source: "live"`）は `session_event` イベントストリームから詳細・損益を自動再計算する（`sessionEventRouter`）。手動セッション（`source: "manual"`）はイベントを持たず、`sessionRouter.create` / `update` で直接値を書き込む。

---

### 所有権検証の共通ルール

各ルーターは冒頭にローカルなオーナーシップ検証関数を持ち、エンティティの親を辿って `room.userId === ctx.session.user.id` を確認する。`tournament` / `blindLevel` / `tournamentChipPurchase` 自体は `userId` を持たず、所有権は常に親 `room` 経由で判定される。

| 検証関数 | 所在 | 経路 | 失敗時コード |
|---|---|---|---|
| `validateRoomOwnership` | tournament.ts | `room` 直接、`room.userId` を照合 | 不在 `NOT_FOUND` / 非所有 `FORBIDDEN` |
| `validateTournamentOwnership` | tournament.ts / blind-level.ts / tournament-chip-purchase.ts | `tournament → room` | 不在 `NOT_FOUND` / 非所有 `FORBIDDEN` |
| `validateBlindLevelOwnership` | blind-level.ts | `blindLevel → tournament → room` | 不在 `NOT_FOUND` / 非所有 `FORBIDDEN` |
| `validateChipPurchaseOwnership` | tournament-chip-purchase.ts | `tournamentChipPurchase → tournament → room` | 不在 `NOT_FOUND` / 非所有 `FORBIDDEN` |
| `validateSessionOwnership` | session.ts | `gameSession.userId` を直接照合 | 不在 `NOT_FOUND` / 非所有 `FORBIDDEN` |
| `validateEntityOwnership` | session.ts | `room`/`currency` は `userId` 照合、`ringGame`/`tournament` は存在のみ確認 | 不在 `NOT_FOUND` / 非所有 `FORBIDDEN` |
| `resolveSessionOwnership` | session-event.ts | `gameSession.userId` を照合し `SessionInfo` を返す | 不在 `NOT_FOUND` / 非所有 `FORBIDDEN` |

`ringGame` / `tournament` は `validateEntityOwnership` では存在チェックのみで `userId` 照合がない点に注意（親 `room` のチェックは別経路で行われ、ここでは省略されている）。

---

### `tournamentRouter`（トーナメント定義）

トーナメントのマスター CRUD と、ブラインドレベル・チップ購入・タグを一括で扱う複合プロシージャを提供する。

| プロシージャ | 種別 | 入力 Zod 制約 | 戻り値 | 副作用 |
|---|---|---|---|---|
| `listByRoom` | query | `roomId: string`、`includeArchived?: boolean` | 各 `tournament` 行 + `blindLevelCount`、`tags[]`（id, name）、`chipPurchases[]`（id, name, cost, chips, sortOrder） | なし |
| `getById` | query | `id: string` | `tournament` 行 + `blindLevels[]`（`level` 昇順）+ `tags[]` | なし |
| `create` | mutation | `roomId`、`name(min1)`、`variant(default "nlh")`、`buyIn/entryFee/startingStack/bountyAmount/tableSize: int 任意`、`currencyId/memo 任意` | 作成された `tournament` 行 | `tournament` を 1 行 INSERT |
| `update` | mutation | `id` 必須、他は任意（数値系は `int().nullable()`、`name(min1)`） | 更新後の `tournament` 行 | 指定フィールドのみ更新（`undefined` はスキップ、`null` は許容して NULL 化）+ `updatedAt` 更新 |
| `archive` | mutation | `id` | 更新後の行 | `archivedAt = now`、`updatedAt = now` |
| `restore` | mutation | `id` | 更新後の行 | `archivedAt = null`、`updatedAt = now` |
| `delete` | mutation | `id` | `{ success: true }` | `tournament` 削除（子の `blindLevel`/`tournamentChipPurchase`/`tournamentTag` は FK cascade で連鎖削除） |
| `createWithLevels` | mutation | `create` の全項目 + `tags?: string[]` + `chipPurchases?: {name, cost:int, chips:int}[]` + `blindLevels?: {isBreak:bool, blind1〜3/ante/minutes: int nullable 任意}[]` | 作成された `tournament` 行 | `tournament` INSERT 後、tags・chipPurchases・blindLevels を `Promise.all` で並列 INSERT |
| `updateWithLevels` | mutation | `update` の全項目 + `tags?`、`chipPurchases?`、`blindLevels`（**必須・配列**） | 更新後の `tournament` 行 | スカラ更新後、`tags`/`chipPurchases` は指定時のみ全削除→再挿入、`blindLevels` は**常に全削除→再挿入** |
| `addTag` | mutation | `tournamentId`、`name(min1)` | 作成された `tournamentTag` 行 | `tournamentTag` を 1 行 INSERT |
| `removeTag` | mutation | `id`（タグ id） | `{ success: true }` | タグ存在確認（不在 `NOT_FOUND`）→ 親トーナメント所有権検証 → 削除 |

#### ブラインドレベル列の付番ロジック（一括系）

`createWithLevels` / `updateWithLevels` でのブラインドレベルおよびチップ購入の**並び順は入力配列のインデックスから決定論的に再採番される**。クライアントが渡す `level` / `sortOrder` フィールドは無視される。

- ブラインドレベル: `level = i + 1`（配列インデックス + 1、1 始まり）。
- チップ購入: `sortOrder = i`（配列インデックス、0 始まり）。
- `updateWithLevels` では `blindLevels` が `undefined` を許さず常に渡される必要があり、毎回 `blind_level` を全削除してから再挿入する（部分更新ではなく全置換）。`tags`・`chipPurchases` は `undefined` のとき手を付けず、配列が渡された場合のみ全置換。

---

### `blindLevelRouter`（個別ブラインドレベル）

トーナメントのブラインドレベルを 1 行単位で操作する。`blind_level` は `level`（NOT NULL）、`isBreak`（boolean、default false）、`blind1`/`blind2`/`blind3`/`ante`/`minutes`（いずれも nullable int）を持つ。

| プロシージャ | 種別 | 入力 Zod 制約 | 戻り値 | 副作用 |
|---|---|---|---|---|
| `listByTournament` | query | `tournamentId` | `blindLevel[]`（`level` 昇順） | なし |
| `create` | mutation | `tournamentId`、`level: int` 必須、`isBreak?: bool`、`blind1〜3/ante/minutes?: int` | 作成行 | 1 行 INSERT。`isBreak` 既定 false、未指定数値は NULL |
| `update` | mutation | `id` 必須、`level?: int`、`isBreak?: bool`、`blind1〜3/ante/minutes?: int nullable` | 更新後の行 | 指定フィールドのみ更新（`undefined` スキップ、`null` で NULL 化） |
| `delete` | mutation | `id` | `{ success: true }` | 1 行削除 |
| `reorder` | mutation | `tournamentId`、`levelIds: string[]` | 並べ替え後の `blindLevel[]`（`level` 昇順） | `levelIds` の各 id に対し `level = index + 1` を `Promise.all` で並列 UPDATE |

#### 並べ替えロジック（`reorder`）

`levelIds` 配列の**順序が新しい `level` 値を決める**。配列の i 番目の id に `level = i + 1` を書き込む（1 始まり）。`levelIds` に含まれない当該トーナメントの他レベルは更新されないため、呼び出し側は全レベルの id を漏れなく渡す前提。戻り値は再採番後の全行を `level` 昇順で返す。

---

### `tournamentChipPurchaseRouter`（チップ購入定義）

トーナメントマスターに紐付く「チップ購入の選択肢」（リバイ／アドオン等の定義）を管理する。`tournament_chip_purchase` は `name`/`cost`/`chips`（NOT NULL）、`sortOrder`（NOT NULL、default 0）を持つ。これは**定義（メニュー）**であり、実際に何回購入したか（count）はセッション側 `session_chip_purchase_result` に保持される。

| プロシージャ | 種別 | 入力 Zod 制約 | 戻り値 | 副作用 |
|---|---|---|---|---|
| `listByTournament` | query | `tournamentId` | `tournamentChipPurchase[]`（`sortOrder` 昇順） | なし |
| `create` | mutation | `tournamentId`、`name(min1)`、`cost: int`、`chips: int` | 作成行 | 既存件数を取得し `sortOrder = existing.length`（末尾追加）として 1 行 INSERT |
| `update` | mutation | `id` 必須、`name?(min1)`、`cost?: int`、`chips?: int` | 更新後の行 | 指定フィールドのみ更新 |
| `delete` | mutation | `id` | `{ success: true }` | 1 行削除 |
| `reorder` | mutation | `tournamentId`、`ids: string[]` | 並べ替え後の全行（`sortOrder` 昇順） | `ids` の各 id に `sortOrder = index`（0 始まり）を並列 UPDATE |

`create` の `sortOrder` は既存行数で決まる（末尾追加）一方、`reorder` は 0 始まりインデックスで全件再採番する。

---

### セッション種別とスナップショット設計

`sessionRouter.create` の入力は `type` を判別子とする **discriminated union**（`cashGameCreateSchema` | `tournamentCreateSchema`）。共通項目は `sessionDate`（秒単位 epoch）、`currencyId?`、`roomId?`、`startedAt?`/`endedAt?`（秒 epoch）、`breakMinutes?(int,min0)`、`memo?`、`tagIds?: string[]`。

| 種別 | 判別子 | 固有必須項目 | スナップショット先 | マスター参照 |
|---|---|---|---|---|
| キャッシュ | `type: "cash_game"` | `buyIn(int,min0)`、`cashOut(int,min0)` | `session_cash_detail` | `ringGameId?`（任意） |
| トーナメント | `type: "tournament"` | `tournamentBuyIn(int,min0)`、`entryFee(int,min0,default 0)` | `session_tournament_detail` | `tournamentId?`（任意） |

**スナップショット凍結**: 作成時、参照したマスター（`ringGame` / `tournament`）のルール内容を詳細行へコピーして凍結する。これによりマスターを後から変更してもセッションの記録値は影響を受けない。

- キャッシュ: `resolveCashRuleSnapshot` が `ringGameId` 参照時は親値 + 明示入力で上書きマージ（`pick` ヘルパ: 入力が `undefined` のときのみ親値を採用）。`ringGameId` 未指定時は入力から `defaultCashSnapshot`（`ruleName` 既定 `"Untitled"`、`variant` 既定 `"nlh"`、他 NULL 許容）を生成し、さらに `insertCashGameSessionDetail` が**新規 `ringGame` を自動生成**して `name = "<variant> <blind1>/<blind2>"` で紐付ける（マスター無しでも詳細を成立させる）。
- トーナメント: `resolveTournamentRuleSnapshot` が `tournamentId` 参照時に親の `name`/`variant`/`buyIn`/`entryFee`/`startingStack`/`bountyAmount`/`tableSize` を取り込み、`tournamentBuyIn`/`entryFee` は「明示入力が非 undefined かつ非 null なら入力優先、そうでなければ親値」、他は `pick` で上書きマージ。
- トーナメント構造（ブラインドレベル列・チップ購入）は `snapshotTournamentStructure` がマスターから `session_blind_level` / `session_chip_purchase` へコピー。各チップ購入には必ず `session_chip_purchase_result`（`count: 0`）を 1 行生成し、結果テーブルが常に更新対象を持つようにする。`create` 入力に `blindLevels` / `chipPurchases` が明示された場合はスナップショット後に全削除→明示配列で上書き（明示優先）。

#### `tournamentCreateSchema` の固有項目とバリデーション

- スナップショット系任意項目: `ruleName(min1)?`、`variant?`、`startingStack?`、`bountyAmount?`、`tableSize?`。
- 結果系: `beforeDeadline?: bool`、`placement?(int,min1)`、`totalEntries?(int,min1)`、`prizeMoney?(int,min0)`、`bountyPrizes?(int,min0)`。
- `blindLevels?`: `{isBreak, blind1〜3/ante/minutes: int nullable 任意}[]`。
- `chipPurchases?`: `chipPurchaseInputSchema`（`name`、`cost:int`、`chips:int`、`count(int,min0,default 0)`）の配列。
- **`.refine` クロスフィールド検証**: `beforeDeadline === true` の場合は無条件で通過。それ以外で `placement` と `totalEntries` が両方与えられたときのみ `placement <= totalEntries` を要求（`"Placement must be less than or equal to total entries"`）。`insertTournamentSessionDetail` では `beforeDeadline === true` のとき `placement`/`totalEntries` を強制的に NULL に、`beforeDeadline` 自体は true のみ保存・false は NULL として格納する。

---

### `sessionRouter`（セッション記録）

| プロシージャ | 種別 | 入力 Zod 制約 | 戻り値 | 副作用 |
|---|---|---|---|---|
| `create` | mutation | `createInputSchema`（種別 union、上記） | `selectCreatedSession`（id/種別/status/source/日時/`liveCashGameSessionId`=`liveTournamentSessionId`=id 等） | `validateCreateLinks` でリンク検証 → `gameSession` INSERT（`status: "completed"`、`source: "manual"`）→ 種別別詳細 INSERT → タグ紐付け → `currencyId` 指定時は損益額の `currencyTransaction` 生成 |
| `list` | query | `cursor?`、`type?`、`roomId?`、`currencyId?`、`dateFrom?`/`dateTo?`（秒 epoch） | `{ items[], nextCursor?, summary }` | なし。キーセットページング（後述）、各行に損益・タグ・チップ購入を付与、`summary` を集計 |
| `getById` | query | `id` | `enrichSessionRows` で付与した単一セッション（list の item と同形） | 不在 / 非所有は `NOT_FOUND` |
| `update` | mutation | `id` 必須 + 多数の任意項目（後述） | 更新後の `gameSession` 行 | 所有権検証 → ライブ連動制約検証 → リンク検証 → `gameSession` スカラ更新 → 種別別詳細更新 → タグ全置換 → 損益再計算 → `currencyTransaction` 同期 |
| `profitLossSeries` | query | `type?`、`roomId?`、`ringGameId?`、`currencyId?`、`dateFrom?`/`dateTo?` | `{ points[] }`（`sessionDate` 昇順の損益・EV・プレイ時間系列） | なし。stats ルーターと共有 |
| `delete` | mutation | `id` | `{ success: true }` | 所有権検証後 `gameSession` 削除（詳細・タグ・イベント等は FK cascade） |

#### `update` の入力項目（抜粋）

`update` は単一スキーマで両種別を受け、`session.kind` により適用先を分岐する（キャッシュは `applyCashDetailUpdate`、トーナメントは `applyTournamentDetailUpdate`）。共通: `sessionDate?`、`roomId?(nullable)`、`currencyId?(nullable)`、`startedAt?`/`endedAt?(nullable)`、`breakMinutes?(int,min0,nullable)`、`memo?(nullable)`、`tagIds?: string[]`。キャッシュ系: `ringGameId?(nullable)`、`buyIn?`/`cashOut?(int,min0)`、`evCashOut?(int,min0,nullable)`、`variant?`、`blind1〜3?`、`ante?`、`anteType?(enum none/all/bb, nullable)`、`tableSize?`。トーナメント系: `tournamentId?(nullable)`、`tournamentBuyIn?`/`entryFee?(int,min0)`、`placement?(int,min1,nullable)`、`totalEntries?(int,min1,nullable)`、`beforeDeadline?(bool,nullable)`、`prizeMoney?`/`bountyPrizes?(int,min0,nullable)`、`chipPurchases?`。

更新時の主要ロジック:

- **詳細行の upsert**: `applyCashDetailUpdate` / `applyTournamentDetailUpdate` は対象詳細行が存在すれば UPDATE、無ければ INSERT。
- **マスター再参照時の再スナップショット**: キャッシュで `ringGameId` を渡すと新親からルールを再スナップショット（明示入力で上書き可）。トーナメントで `tournamentId` を非 null で渡すと `resnapshotTournamentStructure`（既存の `session_blind_level`/`session_chip_purchase` を全削除して新親から再コピー）+ 詳細スナップショット更新を行う。`tournamentId` が `null` の場合は構造を維持（凍結のまま）。
- **`beforeDeadline === true`** を渡すと `placement`/`totalEntries` を NULL にクリア（`applyTournamentScalarUpdates`）。
- **`chipPurchases` 明示指定**は再スナップショット後に `persistSessionChipPurchases`（全削除→再挿入し、各行の `count` を `session_chip_purchase_result` に書き戻す）で上書き。
- **通貨トランザクション同期**（`syncCurrencyTransaction`）: 旧→新の `currencyId` 状態に応じ、旧あり新なし=削除 / 旧なし新あり=生成 / 双方ありで変更=削除+再生成 / 双方ありで同一=金額・日付のみ UPDATE。

#### ライブ連動セッションの編集制約（`assertNoLiveLinkedRestrictedEdits`）

`source === "live"` のセッションは、イベントストリームから導出されるフィールドを手動 `update` で書き換えられない。`session.kind` に応じた禁止フィールド集合のいずれかが入力に含まれる（`!== undefined`）と `BAD_REQUEST`（`"Cannot edit fields derived from live session events: ..."`）。`source !== "live"` のときは無制約。

| kind | 禁止フィールド |
|---|---|
| `cash_game` | `buyIn`, `cashOut`, `evCashOut`, `startedAt`, `endedAt`, `breakMinutes`, `sessionDate`, `ringGameId`, `variant`, `blind1`, `blind2`, `blind3`, `ante`, `anteType`, `tableSize` |
| `tournament` | `tournamentBuyIn`, `entryFee`, `placement`, `totalEntries`, `beforeDeadline`, `prizeMoney`, `bountyPrizes`, `chipPurchases`, `startedAt`, `endedAt`, `breakMinutes`, `sessionDate`, `tournamentId` |

#### 損益計算（`list`/`getById`/`summary`/系列で共有）

- キャッシュ: `computeCashGamePL(buyIn, cashOut) = cashOut - buyIn`。EV 損益は `evCashOut - buyIn`（`evCashOut` が非 null のときのみ）、EV 差分 = EV 損益 − 実損益。
- トーナメント: `computeTournamentPL = (prizeMoney + bountyPrizes) - (tournamentBuyIn + entryFee + チップ購入総コスト)`。各 null は 0 として扱う。チップ購入総コストは `sumChipPurchaseCost = Σ(cost × count)`。
- `summary`（`list` に同梱）: 総セッション数・総損益・勝率（損益 > 0 の割合 %）・平均損益、トーナメント絞り込み時のみ平均順位・総賞金・ITM 率（賞金 > 0 のトーナメント割合）、EV セッションがあれば総 EV 損益・総 EV 差分。

#### ページネーション（複合キーセットカーソル）

`list` は `sessionDate DESC, id DESC` で並び、`id` 単独では日付順と無関係でページがずれるため、カーソルは `"<epochMs>_<id>"` 形式（`encodeSessionCursor`）。`parseSessionCursor` は最初の `_` のみで分割（id 内の `_` を許容）し、区切り無し・空タイムスタンプ・非整数・空 id を `null`（カーソル無し扱い）とする。キーセット条件は `sessionDate < cursorDate OR (sessionDate = cursorDate AND id < cursorId)`。`PAGE_SIZE = 20` で、`limit(PAGE_SIZE + 1)` により次ページ有無を判定し、超過分を切り落として最後の行から `nextCursor` を生成する。

---

### `sessionTagRouter`（セッションタグ）

ユーザー所有のセッションタグ（`session_tag`、`userId` で所有）と、セッションへの紐付け（`session_to_session_tag`）を扱う。タグ自体の CRUD はこのルーター、セッションへの**付与**は `sessionRouter.create`/`update` の `tagIds` 経由で行う。

| プロシージャ | 種別 | 入力 Zod 制約 | 戻り値 | 副作用 |
|---|---|---|---|---|
| `list` | query | なし | 当該ユーザーの `session_tag[]` | なし |
| `create` | mutation | `name(min1)` | 作成行 | `session_tag` を 1 行 INSERT（`userId` 紐付け） |
| `update` | mutation | `id`、`name(min1)` | 更新後の行 | 所有権確認（不在 `NOT_FOUND` / 非所有 `FORBIDDEN`）→ `name` 更新 |
| `delete` | mutation | `id` | `{ success: true }` | 所有権確認 → **先に `session_to_session_tag` の中間行を全削除** → `session_tag` 削除 |

**セッションへの紐付けロジック**（`sessionRouter` 側）: `create` では `insertSessionTags` が `tagIds` を `session_to_session_tag`（`sessionId` × `sessionTagId`）へ一括 INSERT（空配列・未指定は何もしない）。`update` では `tagIds !== undefined` のとき当該セッションの中間行を全削除してから再挿入する**全置換**方式。`enrichSessionRows` は `session_to_session_tag` を `session_tag` に inner join して各セッションへ `tags: {id, name}[]` を付与する。

---

### `sessionEventRouter`（ライブセッションイベント）

ライブセッションのイベントストリームを操作し、変更のたびに損益・詳細を再計算する。セッション id は `sessionId` / `liveCashGameSessionId` / `liveTournamentSessionId` のいずれかで指定（`resolveSessionId` がこの優先順で解決、いずれも無ければ `BAD_REQUEST`）。

| プロシージャ | 種別 | 入力 Zod 制約 | 戻り値 | 副作用 |
|---|---|---|---|---|
| `list` | query | `sessionIdInput`（3 つの id いずれか） | イベント配列（`occurredAt` 昇順, `sortOrder` 昇順）。`payload` は JSON パース済み | なし |
| `create` | mutation | `sessionIdInput` + `eventType(enum ALL_EVENT_TYPES)` + `occurredAt?(秒)` + `payload: unknown` | 作成イベント（payload パース済み） | 多段検証（後述）→ `session_event` INSERT → セッション再計算 |
| `update` | mutation | `id` + `occurredAt?(秒)` + `payload?: unknown` | 更新イベント | 時刻順序検証 → payload 再検証 → UPDATE。トーナメントの `session_start` で `timerStartedAt` を `session_tournament_detail` に反映 → 再計算 |
| `delete` | mutation | `id` | `{ success: true }` | ライフサイクルイベント（`session_start`/`session_end`）は削除不可（`BAD_REQUEST`）→ 削除 → 再計算 |

#### イベント種別の分類

| カテゴリ | 種別 | 適用セッション |
|---|---|---|
| ライフサイクル（`LIFECYCLE_EVENT_TYPES`） | `session_start`, `session_end` | 両方。手動作成不可（`MANUAL_CREATE_BLOCKED_EVENT_TYPES`）。削除不可 |
| 一時停止/再開（`PAUSE_RESUME`） | `session_pause`, `session_resume` | 両方 |
| キャッシュ固有（`CASH_EVENT_TYPES`） | `chips_add_remove`, `all_in` | `cash_game` のみ |
| トーナメント固有（`TOURNAMENT_EVENT_TYPES`） | `purchase_chips` | `tournament` のみ |
| 共通（`COMMON_EVENT_TYPES`） | `update_stack`, `player_join`, `player_leave`, `memo` | 両方 |

#### `create` の検証パイプライン（順序）

1. `MANUAL_CREATE_BLOCKED_EVENT_TYPES`（`session_start`/`session_end`）は手動作成不可 → `BAD_REQUEST`。
2. `isValidEventTypeForSessionType`: 種別固有イベントがセッション種別に一致するか（不一致 `BAD_REQUEST`）。
3. `getSessionCurrentState` で現在状態を導出し `isEventAllowedInState` で許否判定（不許可 `BAD_REQUEST`）。
   - 状態導出: `session_end` があれば `completed`、それ以外は `session_start`/`session_pause`/`session_resume` の最新（`occurredAt` desc → `sortOrder` desc）が `session_pause` なら `paused`、他は `active`。
   - 許可: `completed` では全不許可。`paused` では `memo`/`session_resume`/`session_end` のみ。`active` ではキャッシュ/トーナメント/共通イベント + `session_pause` + `session_end`。
4. `validateEventPayload`: 種別ごとの payload Zod 検証（`session_start`/`session_end` はセッション種別で分岐）。
5. `nextAppendSortOrder` で末尾 `sortOrder` 採番、`assertOccurredAtOrdering` で時刻整合検証（後述）。

#### イベント payload スキーマ（チップ購入 buy-in/add-on/re-entry の扱い）

| eventType | payload | 備考 |
|---|---|---|
| `session_start`（cash） | `{ buyInAmount: int≥0 }` | 初期バイイン |
| `session_start`（tournament） | `{ timerStartedAt?: int|null }` | `update` 時に `session_tournament_detail.timerStartedAt` へ反映 |
| `session_end`（cash） | `{ cashOutAmount: int≥0 }` | |
| `session_end`（tournament） | `beforeDeadline` 判別 union: false なら `{placement≥1, totalEntries≥1, prizeMoney≥0, bountyPrizes≥0}`、true なら `{prizeMoney≥0, bountyPrizes≥0}` | |
| `chips_add_remove`（cash） | `{ amount: int ≠ 0 }` | **符号付き**: 正=チップ追加（アドオン/トップアップ）、負=早期キャッシュアウト。0 は拒否 |
| `all_in`（cash） | `{ potSize≥0, trials(int)≥1, equity 0〜100, wins≥0 }` | EV 計算用 |
| `purchase_chips`（tournament） | `{ sessionChipPurchaseId(min1), name(min1), cost: int≥0, chips: int≥0 }` | 定義（`session_chip_purchase`）への参照 + 表示/PL 用の非正規化スナップショット。リバイ/アドオン/リエントリは「定義」を選び `purchase_chips` イベントを積むことで count が増える |
| `update_stack`（共通） | `{ stackAmount: int≥0, remainingPlayers?, totalEntries?, chipPurchaseCounts?: {name, count, chipsPerUnit}[] }` | トーナメントでは進行メタも同梱可。`averageStack` は読み取り時に導出（保存しない） |
| `player_join` | `{ playerId?, isHero(default false), seatPosition? 0〜8 }` | |
| `player_leave` | `{ playerId?, isHero(default false) }` | |
| `memo` | `{ text(min1) }` | |

チップ購入（buy-in / add-on / re-entry）の扱いは 2 段構成: ①トーナメント定義側の `tournament_chip_purchase`（メニュー）→セッション作成時に `session_chip_purchase` へスナップショット、② ライブでは `purchase_chips` イベントを積むことで購入を記録し、`session_chip_purchase_result.count` が再計算で更新される。手動セッションでは `chipPurchaseInputSchema` の `count` を直接指定する。

#### 再計算の副作用（`recalculateSession`）

`create`/`update`/`delete` の各イベント変更後に必ず実行。`cash_game` は `recalculateCashGameSession`、`tournament` は `recalculateTournamentSession`（`services/live-session-pl.ts`）を呼び、イベントストリームから詳細行・損益・休憩時間（`computeBreakMinutesFromEvents`: pause→resume の差分積算、未 resume なら現在時刻まで）を再導出して書き戻す。

---

### `session-event-time.ts`（イベント時刻計算ユーティリティ）

イベントの `occurredAt` は**分単位に切り捨て**て保持され、`sortOrder` と整合する分単位の単調性が強制される。

| 関数 | 役割 | ロジック |
|---|---|---|
| `floorToMinute(date)` | 分未満切り捨て | `setSeconds(0, 0)` した複製を返す（秒・ミリ秒を 0 化） |
| `resolveOccurredAt(secs?, now)` | 既定時刻解決 | 未指定なら `now`、指定なら `secs * 1000` を採用し `floorToMinute`。固定値（sessionDate 等）にフォールバックしない |
| `nextAppendSortOrder(db, sessionId)` | 末尾採番 | 当該セッションの `max(sortOrder)`、行が無ければ 0、あれば `max + 1` |
| `assertOccurredAtOrdering(db, sessionId, sortOrder, newOccurredAt)` | 時刻順序検証 | `sortOrder` 上の直前/直後イベントと**分エポック**（`floor(ms/60000)`）で比較。直前より前なら `BAD_REQUEST`（`"occurredAt would precede the previous event by minute; reorder via sortOrder instead"`）、直後より後なら `BAD_REQUEST`（`"...would follow the next event..."`） |

`create` 時は新規 `sortOrder`（末尾）に対して、`update` 時は対象イベントの既存 `sortOrder` に対して順序検証を行う。比較は分単位なので、同一分内のイベントは順序違反とならない（同分のずれは `sortOrder` で管理する設計）。

## 8. API仕様 - ライブセッション・統計・AI抽出

### 概要

本セクションが対象とするのは、進行中のポーカーセッションを記録する「ライブセッション」ルーター群（キャッシュゲーム・トーナメント・着席プレイヤー）、それらの集計を行う統計ルーター、更新通知の既読管理、そして Anthropic SDK を用いた構造化データ抽出ルーターである。

ライブセッションは独立した行に状態を持たせるのではなく、**イベントソーシング**で設計されている。`game_session` 行（`kind = "cash_game" | "tournament"`、`source = "live"`）を軸に、`session_event` テーブルへ追記される一連のイベント（`session_start` / `session_end` / `chips_add_remove` / `all_in` / `purchase_chips` / `update_stack` / `player_join` / `player_leave` / `session_pause` / `session_resume` / `memo`）を時系列で畳み込むことで、ステータス・損益・着席プレイヤー・ヒーロー座席などのあらゆる派生状態を読み取り時に再計算する。着席プレイヤー専用テーブルは存在せず、`player_join` / `player_leave` イベント列を畳んで復元する。ルールデータ（ブラインド・バイインなど）はセッション作成時に親エンティティ（`ring_game` / `tournament`）から `session_cash_detail` / `session_tournament_detail` へスナップショットされ、以後マスタを編集・改名してもライブシーンの表示には伝播しない。

全プロシージャは `protectedProcedure`（要認証）であり、各ハンドラ冒頭で `ctx.session.user.id` による所有者チェックを行う。他人のセッション・存在しないセッションはいずれも `NOT_FOUND`（情報漏洩を避けるため意図的に同一エラー）として扱う。

イベントの `occurredAt` は `floorToMinute`（秒・ミリ秒を 0 に切り捨て）で分単位に丸めて格納される。追記時の `sortOrder` は当該セッションの既存最大値 + 1（`nextAppendSortOrder` / `getNextEventSortOrder`、イベントが無ければ 0）。イベントの読み出し順序は一貫して `ORDER BY occurredAt ASC, sortOrder ASC`。

### ライブセッションのライフサイクルと状態遷移

ステータスは `active` / `paused` / `completed` の3値で、`game_session.status` に永続化されると同時に `computeSessionStateFromEvents` によりイベント列からも導出可能（`session_end` があれば `completed`、最後の状態系イベントが `session_pause` なら `paused`、それ以外は `active`）。

| 操作 | 起点ステータス | 追記/操作されるイベント | 結果ステータス |
|---|---|---|---|
| `create` | （新規）| `session_start`（sortOrder 0） | `active` |
| `complete` | `active` / `paused` | `session_end` を末尾追記 → 再計算 | `completed` |
| `reopen`（キャッシュのみ） | `completed` | `session_end` を削除し、`update_stack`（cashOut 値）+ `session_pause` + `session_resume` を再構成 → 再計算 | `paused` / `active`（イベントから再導出）|
| `discard` | `active` / `paused`（`completed` は不可） | `game_session` 行を物理削除 | （削除）|
| `updateHeroSeat` | 任意 | `player_join`（isHero）または `player_leave`（isHero）を追記 | 不変 |

ライフサイクル上の主要な制約・不変条件:

- **同時アクティブセッションは1つだけ**: `create`（キャッシュ・トーナメント両方）と `reopen`（キャッシュ）は、同一ユーザーで `source = "live"` かつ `status != 'completed'` のセッションが既に存在すると `BAD_REQUEST: "Another session is already active"` を投げる。
- **キャッシュの reopen は完了済みを巻き戻す特殊処理**: `session_end` を削除し、キャッシュアウト額を `update_stack` に転記したうえで `session_pause` → `session_resume` のペアを挿入する。これにより `computeSessionStateFromEvents` がペアを正しい順序で認識し、休憩分の計算が pause を閉じられる（`session_resume` は `session_pause` より厳密に後の `sortOrder` を持つ）。
- **トーナメントは reopen 不可**: `liveTournamentSessionRouter.reopen` は無条件で `FORBIDDEN: "Tournament sessions cannot be reopened after completion"` を投げる（DB アクセスなし）。
- `complete` は既に `completed` のセッションに対し `BAD_REQUEST: "Session is already completed"`。
- `discard` は `completed` を弾く（キャッシュ: `"Cannot discard a completed session"` / トーナメント: `"Only active sessions can be discarded"`）。

`complete` / `reopen` 後は `recalculateCashGameSession` / `recalculateTournamentSession`（後述の損益サービス）が呼ばれ、`game_session` の `status` / `startedAt` / `endedAt` / `breakMinutes` / `sessionDate`、明細テーブル（`session_cash_detail` / `session_tournament_detail`）、`currency_transaction` を一括同期する。

### ライブキャッシュゲームルーター（`liveCashGameSession`）

| プロシージャ | 種別 | 入力（Zod 制約） | 主な戻り値 | 副作用 |
|---|---|---|---|---|
| `list` | query | `status?: enum(active/paused/completed)`、`cursor?: string`、`limit: int 1..100 = 20` | `{ items, nextCursor }`。各 item に `eventCount`、`latestStackAmount`（最後の `update_stack` の `stackAmount`）、部屋名・通貨名・スナップショット名等を付与 | なし |
| `getById` | query | `{ id: string }` | セッション行 + `ringGameId`、`heroSeatPosition`、`events`（全件）、`summary`、`session_cash_detail` のスナップショット各項（`ruleName`/`variant`/`blind1..3`/`ante`/`anteType`/`minBuyIn`/`maxBuyIn`/`tableSize`） | なし |
| `create` | mutation | `roomId?`、`ringGameId?`、`currencyId?`、`memo?`、`initialBuyIn: number ≥ 0` | `{ id }` | 同時アクティブチェック → `game_session`（active/live/cash_game）+ `session_cash_detail`（スナップショット）+ `session_start` イベント（payload `{ buyInAmount: initialBuyIn }`）を挿入 |
| `update` | mutation | `id`、`memo?: string\|null`、`roomId?: string\|null`、`currencyId?: string\|null`、`ringGameId?: string\|null` | 更新後セッション + `ringGameId` | `game_session` と `session_cash_detail` を部分更新。`ringGameId` 指定時はリング所有検証＋部屋整合チェック＋スナップショット再取得 |
| `updateSnapshot` | mutation | `id`、`ruleName?: min(1)`、`variant?`、`blind1..3?: int\|null`、`ante?: int\|null`、`anteType?: enum(none/all/bb)\|null`、`minBuyIn?/maxBuyIn?/tableSize?: int\|null` | `{ id }` | `session_cash_detail` のみ更新（マスタ `ring_game` は不変）。指定フィールドが無ければ no-op |
| `complete` | mutation | `id`、`finalStack: int ≥ 0` | `{ id, pokerSessionId }` | `session_end`（payload `{ cashOutAmount: finalStack }`）追記 → `recalculateCashGameSession` |
| `reopen` | mutation | `{ id }` | `{ id }` | 完了済みのみ可。同時アクティブチェック。`session_end` を分解（上記参照）→ 再計算 |
| `discard` | mutation | `{ id }` | `{ id }` | `game_session` 物理削除（完了済み不可） |
| `updateHeroSeat` | mutation | `id`、`heroSeatPosition: int 0..8 \| null` | `{ id }` | 既に着席中で新座席指定なら `BAD_REQUEST`。同値なら no-op。`null` で `player_leave`（isHero）、値ありで `player_join`（isHero, seatPosition）を追記 |

`create` / `update` の入力検証で特筆すべき点:

- `create` で `ringGameId` を指定し、そのリングに `minBuyIn` / `maxBuyIn` が設定されている場合、`initialBuyIn` が範囲外なら `BAD_REQUEST`（`"Initial buy-in must be at least/at most N"`）。
- `resolveRingGameAssignment`: リングが見つからなければ `NOT_FOUND`。リングが部屋に属しその部屋が他人所有なら `FORBIDDEN`。セッションの現部屋とリングの部屋が異なれば `BAD_REQUEST`。セッション側の `roomId` / `currencyId` が未設定ならリングのものを継承（patch）。

`getById` の `summary` 構造（`computeSummaryFromEvents` と `computeCashGamePLFromEvents` の合成）:

| フィールド | 算出元 |
|---|---|
| `totalBuyIn` | `session_start.buyInAmount` + 正の `chips_add_remove.amount` の合計 |
| `cashOut` | `session_end.cashOutAmount`（未完了なら null）|
| `profitLoss` | 損益サービスの式（後述） |
| `evCashOut` / `evDiff` | `all_in` イベントの EV 計算（後述） |
| `addonCount` | 正の `chips_add_remove` イベント数 |
| `maxStack` / `minStack` / `currentStack` | `update_stack.stackAmount` の最大/最小/最後 |

### ライブトーナメントルーター（`liveTournamentSession`）

| プロシージャ | 種別 | 入力（Zod 制約） | 主な戻り値 | 副作用 |
|---|---|---|---|---|
| `list` | query | `status?`、`cursor?`、`limit: int 1..100 = 20` | `{ items, nextCursor }`。各 item に `eventCount`、`latestStackAmount`、`remainingPlayers`、`averageStack` を付与 | なし |
| `getById` | query | `{ id: string }` | セッション + `tournamentId`/`buyIn`/`entryFee`/`timerStartedAt`/`heroSeatPosition`/`events`/`blindLevels`/`chipPurchases`/`summary` + スナップショット各項 | なし |
| `create` | mutation | `roomId?`、`tournamentId?`、`currencyId?`、`buyIn?: int ≥ 0`、`entryFee?: int ≥ 0`、`memo?`、`timerStartedAt?: int`（unix 秒） | `{ id }` | 同時アクティブチェック → `game_session` + `session_tournament_detail`（スナップショット、`timerStartedAt` は `*1000` で Date 化）+ `session_start` イベント（payload `{ timerStartedAt }`）。`tournamentId` 指定時は `snapshotTournamentStructure` でブラインド/チップ購入を複製 |
| `update` | mutation | `id`、`memo?\|null`、`roomId?\|null`、`currencyId?\|null`、`tournamentId?: string\|null`、`timerStartedAt?: int\|null` | 更新後セッション + `tournamentId`/`buyIn`/`entryFee`/`timerStartedAt` | `game_session` と `session_tournament_detail` を更新。`tournamentId` 指定時は所有/部屋検証＋スナップショット再取得＋`resnapshotTournamentStructure`。`timerStartedAt` 指定時は `session_start` イベント payload にも反映 |
| `updateSnapshot` | mutation | `id`、`ruleName?: min(1)`、`variant?`、`tournamentBuyIn?/entryFee?/startingStack?/bountyAmount?/tableSize?: int\|null`、`blindLevels?: 配列`、`chipPurchases?: 配列` | `{ id }` | `session_tournament_detail` のスカラ更新。`blindLevels` 指定時は `session_blind_level` を全削除→再挿入。`chipPurchases` 指定時は `persistSessionChipPurchases`（count 0 で再シード、完了時に上書き）。マスタ `tournament` は不変 |
| `complete` | mutation | 判別共用体（`beforeDeadline` で分岐、下記） | `{ id, pokerSessionId }` | `session_end` 追記 → `recalculateTournamentSession` |
| `reopen` | mutation | `{ id }` | （なし） | 常に `FORBIDDEN` |
| `discard` | mutation | `{ id }` | `{ id }` | `game_session` 物理削除（完了済み不可） |
| `updateHeroSeat` | mutation | `id`、`heroSeatPosition: int 0..8 \| null` | `{ id }` | キャッシュ版と同一ロジック |

`complete` の入力は `beforeDeadline` を判別キーとする `discriminatedUnion`:

| `beforeDeadline` | 追加フィールド（全て `int`） |
|---|---|
| `false`（締切後・着順確定） | `placement: ≥ 1`、`totalEntries: ≥ 1`、`prizeMoney: ≥ 0`、`bountyPrizes: ≥ 0` |
| `true`（締切前・着順未確定） | `prizeMoney: ≥ 0`、`bountyPrizes: ≥ 0`（`placement` / `totalEntries` なし）|

`updateSnapshot` の `blindLevels` 各要素: `{ isBreak: boolean, blind1?/blind2?/blind3?/ante?/minutes?: int|null }`。挿入時 `level` は配列インデックス + 1。`chipPurchases` 各要素: `{ name: string, cost: int, chips: int }`。

`getById` / `list` のスタック統計（`computeStackStats`、`update_stack` イベントを畳む）:

| フィールド | 算出 |
|---|---|
| `maxStack` / `minStack` / `currentStack` | `stackAmount` の最大 / 最小 / 最後 |
| `remainingPlayers` / `totalEntries` | `update_stack` payload の最新非 null 値 |
| `averageStack` | `startingStack`・`totalEntries`・`remainingPlayers (>0)` が揃うとき `round((startingStack × totalEntries + Σ(count × chipsPerUnit)) / remainingPlayers)`。チップ総量は payload の `chipPurchaseCounts` から算出。条件不成立なら null |

### 着席プレイヤールーター（`sessionTablePlayer`）

着席状態は専用テーブルを持たず、`player_join` / `player_leave` イベント列を `computeSeatedPlayersFromEvents` で畳んで復元する。セッション ID は `sessionId` / `liveCashGameSessionId` / `liveTournamentSessionId` のいずれか1つを受け取り、`requireSessionId` が最初に非 undefined のものを採用（全て未指定なら `BAD_REQUEST`）。全プロシージャは冒頭で `resolveSessionOwnership`（セッション存在＋所有者一致、不一致は `NOT_FOUND`）を行う。

| プロシージャ | 種別 | 入力（共通: session ID 3種のうち1つ） | 戻り値 | 副作用 |
|---|---|---|---|---|
| `list` | query | `activeOnly: boolean = false` | `{ items }`。各 item: `id`(=playerId)、`player`(id/name/memo/isTemporary)、`isActive`、`joinedAt`、`leftAt`、`seatPosition`、`stints[]`（join→leave の全履歴）。`joinedAt` 昇順 | なし。`activeOnly` で在席者のみに絞る |
| `add` | mutation | `playerId: min(1)`、`seatPosition?: int 0..8` | `{ id, playerId }` | 既存プレイヤーの所有検証（他人/不在は `NOT_FOUND`）。既に在席中なら `BAD_REQUEST`。`player_join` イベント追記 |
| `addNew` | mutation | `playerName: min(1)`、`playerMemo?`、`playerTagIds?: string[]`、`seatPosition?: int 0..8` | `{ id, playerId }` | 新規 `player` 行作成（+タグ関連）→ `player_join` 追記 |
| `updateSeat` | mutation | `playerId: min(1)`、`seatPosition: int 0..8 \| null` | `{ id, playerId }` | 在席中でなければ `NOT_FOUND`。当該プレイヤーの**最新の** `player_join` イベントの payload を書き換えて座席を移動（`null` なら座席フィールドを除去） |
| `remove` | mutation | `playerId: min(1)` | `{ id, playerId }` | 在席中でなければ `BAD_REQUEST`。`player_leave` イベント追記 |
| `addTemporary` | mutation | `seatPosition?: int 0..8` | `{ id, playerId }` | 名前 `"Anonymous"`・`isTemporary: true` の仮プレイヤーを作成。`memo` に参加時刻（UTC）・部屋名・ゲーム名・座席番号（`seatPosition + 1`）を HTML で埋め込み → `player_join` 追記 |

座席ロジックの要点:

- 座席はプレイヤーの最新 `player_join` イベント payload 上にのみ存在する（イベントソース化のため、座席変更はそのイベントの patch で表現）。
- `stints` は同一プレイヤーの離脱・再着席を全て保持し、トップレベルの `isActive` / `seatPosition` / `joinedAt` / `leftAt` は最後の stint（現在状態）を反映。
- `player_leave` で開いている stint が無い場合は no-op（`closeLatestOpenStint`）。
- `playerId` を持たないイベント（ヒーロー自身の着席）はこの roster には含まれず、`computeHeroSeatPositionFromEvents` が別途導出する。

### 損益計算サービス（`live-session-pl.ts`）

イベント列を入力に損益・状態・着席を導出する純関数群と、それらを永続化する非同期関数群からなる。

#### キャッシュ損益 `computeCashGamePLFromEvents(events)`

入力イベントを走査して以下を集計する:

| 中間量 | 集計対象 |
|---|---|
| `totalBuyIn` | `session_start.buyInAmount` + 正の `chips_add_remove.amount` |
| `addonTotal` | 正の `chips_add_remove.amount` の合計 |
| `chipRemoveTotal` | 負の `chips_add_remove.amount` の絶対値合計（早期キャッシュアウト分）|
| `cashOut` | `session_end.cashOutAmount`（未完了なら null）|
| `totalEvDiff` | 各 `all_in` イベントについて `potSize × (equity/100) − (potSize / trials) × wins` の総和 |

出力:

- `profitLoss = cashOut === null ? null : cashOut + chipRemoveTotal − totalBuyIn`
- `evCashOut = cashOut === null ? null : cashOut + totalEvDiff`
- `evDiff = totalEvDiff`
- そのほか `totalBuyIn` / `addonTotal` / `cashOut`

`all_in` payload は `{ potSize ≥ 0, trials: int ≥ 1, equity: 0..100, wins ≥ 0 }`。EV 差分は「期待獲得額（potSize × 勝率）」と「実際の試行結果（potSize/trials × 勝ち数）」の差で、ランナウト運の影響を測る。

#### トーナメント損益 `computeTournamentPLFromEvents(events, tournamentBuyIn?, entryFee?)`

| 中間量 | 集計対象 |
|---|---|
| `chipPurchaseCounts` | `purchase_chips.sessionChipPurchaseId` ごとの購入回数 Map |
| `chipPurchaseCost` | `purchase_chips.cost` の総和 |
| `placement` / `totalEntries` | `session_end`（`beforeDeadline=false`）から取得 |
| `prizeMoney` / `bountyPrizes` | `session_end` から取得 |
| `beforeDeadline` | `session_end` が `beforeDeadline=true` なら true |

出力 `profitLoss = prizeMoney === null ? null : (prizeMoney + bountyPrizes) − (tournamentBuyIn + entryFee + chipPurchaseCost)`（各 null は 0 として扱う）。

#### 状態・休憩・着席の導出（純関数）

- `computeSessionStateFromEvents`: `startedAt`（最初の `session_start`）、`endedAt`（最後の `session_end`）、`status`（最後の状態系イベントから `completed` / `paused` / `active`）。
- `computeBreakMinutesFromEvents`: `session_pause` から `session_resume` までの経過 ms を積算し分に切り捨て。閉じていない pause は「現在時刻まで」を加算。
- `computeSeatedPlayersFromEvents` / `computeHeroSeatPositionFromEvents`: 着席ルーター節で前述。

#### 再計算・永続化（非同期）

`recalculateCashGameSession(db, sessionId, userId)` / `recalculateTournamentSession(...)` は完了/巻き戻し時に呼ばれ、以下を一貫適用する:

1. イベント列から状態を導出し `game_session` の `status` / `startedAt` / `endedAt`（completed 時のみ設定、そうでなければ null）/ `updatedAt` を更新。
2. **未完了なら** `currency_transaction` を削除して終了（途中状態の損益は通貨台帳に載せない）。
3. 完了なら損益・休憩分（>0 のときのみ、なければ null）・`sessionDate`（実 `startedAt` 基準）を計算し、明細テーブル（キャッシュ: `buyIn`/`cashOut`/`evCashOut`、トーナメント: `placement`/`totalEntries`/`beforeDeadline`/`prizeMoney`/`bountyPrizes`）へ upsert。
4. トーナメントは `purchase_chips` 由来の購入回数を `session_chip_purchase_result` に upsert で書き戻す（未購入は count 0）。トーナメントのバイイン/フィーはスナップショット優先・マスタ `tournament` フォールバックで解決。
5. `syncCurrencyTransaction`: `currencyId` と `profitLoss` が揃うときのみ、`currency_transaction`（`transactionType="Session Result"`、無ければ自動作成）を upsert。

### 統計ルーター（`stats`）

全プロシージャ共通の入力（`statsFilterShape`）と通貨スコープ制約:

| フィールド | 制約 |
|---|---|
| `currencyId?` | string |
| `type?` | `enum(cash_game, tournament)` |
| `roomId?` | string |
| `dateFrom?` / `dateTo?` | number（**unix 秒**、クエリ時に `*1000`） |
| `normalized` | boolean = false |

**通貨スコープガード**（`assertCurrencyScope`）: 異種通貨の生額比較は無意味なため、`currencyId` を指定するか `normalized = true` のいずれかが必須。両方とも満たさないと `BAD_REQUEST: "currencyId is required unless normalized is enabled"`。

データ取得（`fetchStatsRows`）はユーザー所有の `game_session` に `type` / `roomId` / `currencyId` / 日付範囲フィルタを適用し、キャッシュ/トーナメント明細・部屋・チップ購入結果を結合して `StatsSessionRow[]` に正規化する。各行の損益は `computeCashGamePL`（= `cashOut − buyIn`）または `computeTournamentPL`（= 賞金合計 − 投資合計）で計算。`playMinutes` は `max(0, (endedAt − startedAt)/60000 − breakMinutes)`。

**正規化値**（`normalizedSessionValue`）: キャッシュは `profitLoss / bigBlind`（= blind2、bb 単位）、トーナメントは `profitLoss / buyInTotal`（バイイン単位）。分母が欠落/ゼロなら null（正規化集計から除外）。cash の bb と tournament の bi は単位が異なるため**決して合算しない**設計。

| プロシージャ | 種別 | 入力 | 戻り値 |
|---|---|---|---|
| `summary` | query | `statsFilterSchema` | `StatsSummary`（下表） |
| `breakdown` | query | `statsFilterSchema` + `groupBy: enum` | `{ groups: BreakdownRow[] }` |
| `profitLossSeries` | query | `statsFilterSchema` | `{ points }`（時系列、後述） |

`summary`（`StatsSummary`）の各指標:

| 指標 | 計算 |
|---|---|
| `totalSessions` | 行数 |
| `totalProfitLoss` | 全行 `profitLoss` の総和（生通貨額） |
| `winRate` | `profitLoss > 0` の割合（%） |
| `avgProfitLoss` | `totalProfitLoss / totalSessions` |
| `totalPlayMinutes` | `playMinutes` の総和 |
| `hourlyRate` | キャッシュ損益 ÷ キャッシュプレイ時間（時間）。時間 0 なら null |
| `bbPerHour` | キャッシュ bb 合計 ÷ キャッシュプレイ時間。ハンド数は持たないため bb/100 の代理指標 |
| `cashNormalizedProfitLoss` | キャッシュ各行の bb 値の総和（正規化可能行が無ければ null） |
| `cashEvDiffNormalized` | キャッシュ `evDiff / bigBlind` の総和 |
| `tournamentNormalizedProfitLoss` | トーナメント各行の bi 値の総和 |
| `totalEvProfitLoss` / `totalEvDiff` | キャッシュ EV 損益 / EV 差分の総和（EV データ行が無ければ null）|
| `roi` | 集計 ROI: `(賞金合計 − 投資合計) / 投資合計 × 100`。同一通貨前提 |
| `avgRoi` | 各セッション ROI%（比率）の平均。通貨混在に安全 |
| `itmRate` | 賞金 > 0 のトーナメント割合（%） |
| `avgPlacement` | `placement` の平均 |
| `totalPrizeMoney` | トーナメント賞金+バウンティ合計 |

`breakdown` の `groupBy` は `room` / `stakes` / `type` / `dayOfWeek` / `length` / `month` / `year`。`breakdownKeyLabel` がキー/ラベルを決定し、null を返す行はグループから除外される:

| `groupBy` | キー / バケット規則 | 除外条件 |
|---|---|---|
| `room` | `roomId`（無ければ `"none"` / `"No room"`） | — |
| `type` | `cash_game` / `tournament` | — |
| `stakes` | `"blind1/blind2"` | キャッシュ以外を除外 |
| `length` | プレイ時間を時間単位で床関数 → `"N~N+1h"` | `playMinutes` が null なら除外 |
| `dayOfWeek` | UTC 曜日（0=Sun） | — |
| `month` | `"YYYY-MM"`（UTC）| — |
| `year` | `"YYYY"`（UTC）| — |

各 `BreakdownRow` は `sessions` / `profitLoss`（生額）/ `cashNormalizedProfitLoss` / `tournamentNormalizedProfitLoss`（cash・tournament を分離保持）/ `winRate`（`profitLoss > 0` 割合）/ `playMinutes`。並び順は時系列軸（dayOfWeek/length/year は数値、month は辞書）では昇順、それ以外（room/stakes/type）は `sessions` 降順 → `profitLoss` 降順 → ラベル昇順。

`profitLossSeries`（`fetchProfitLossSeries`、`session.ts` 由来）は `sessionDate` 昇順・id 昇順で各セッションを1点に変換した `{ points }` を返す。各 point: `id`、`type`、`sessionDate`（unix 秒）、`profitLoss`、`evProfitLoss`（キャッシュのみ）、`playMinutes`、`bigBlind`（= ring の blind2）、`buyInTotal`。`ringGameId` フィルタにも対応する。クライアント側で累積すると累積損益曲線になる。

### 更新通知既読ルーター（`updateNoteView`）

リリースノート（バージョン単位）の既読状態をユーザーごとに管理する。

| プロシージャ | 種別 | 入力 | 戻り値 | 副作用 |
|---|---|---|---|---|
| `list` | query | （なし） | ユーザーの全 `update_note_view` 行（`viewedAt` 降順） | なし |
| `markViewed` | mutation | `{ version: string min(1) }` | 既読行（既存なら冪等に返す）| 同一 `(userId, version)` が無ければ新規挿入。あれば挿入せず既存を返す |
| `getLatestViewedVersion` | query | （なし） | `{ version, viewedAt }`（未閲覧なら両方 null） | なし |

### AI 抽出ルーター（`aiExtract`）

Anthropic SDK（`@anthropic-ai/sdk`）を用い、画像/URL から構造化データを抽出する2つの mutation。いずれもモデル `claude-opus-4-8` を使用し、`ctx.anthropicApiKey`（`ANTHROPIC_API_KEY` 由来）が無ければ `INTERNAL_SERVER_ERROR: "AI extraction is not configured (...)"`。

入力ソースは判別共用体 `SourceSchema`:

| `kind` | フィールド |
|---|---|
| `"url"` | `url: string().url()` |
| `"image"` | `data: string`（base64）、`mediaType: enum(image/jpeg, image/png, image/gif, image/webp)` |

| プロシージャ | 種別 | 入力 | 抽出対象 | 出力 |
|---|---|---|---|---|
| `extractTournamentData` | mutation | `sources: SourceSchema[] 1..5` | ポーカートーナメントの構造データ | `ExtractedTournamentData` |
| `extractTablePlayers` | mutation | `sourceApp: enum(TABLE_PLAYER_SOURCE_APP_IDS)`、`sources: 長さ1` | テーブル画像から各座席のプレイヤー名 | `{ seats }`（座席番号で重複排除済み） |

#### `extractTournamentData`

ソース処理:
- `kind = "image"` → base64 画像ブロック。
- `kind = "url"` かつ拡張子が画像（`.jpg/.jpeg/.png/.gif/.webp`、クエリ付き可）→ URL 画像ブロック。
- それ以外の URL → `fetchAndConvertToMarkdown` で取得。`HTMLRewriter` で `script/style/noscript/nav/header/footer/aside` を除去し、Cloudflare Workers に `DOMParser` が無いため `@mixmark-io/domino` でパース、`turndown` + GFM table プラグインで Markdown 化し先頭 **30,000 文字** に切り詰める。空なら null（除外）。

抽出は Anthropic の **tool use** で実行（`tool_choice` で `extract_tournament_data` を強制、`max_tokens: 2048`）。ツール入力スキーマ（`TOOL_INPUT_SCHEMA`、`required: []` で全項目省略可、説明文は日本語、空文字列/null/空配列を返さない指示付き）が抽出構造を定義する:

| フィールド | 型 / 意味 |
|---|---|
| `name` | トーナメント名 |
| `buyIn` | バイイン金額 |
| `entryFee` | エントリーフィー・レイク |
| `startingStack` | スターティングスタック（チップ数） |
| `tableSize` | 1テーブル最大人数（通常 9 / 10） |
| `chipPurchases[]` | `{ name, cost, chips }`（リバイ・アドオン等） |
| `blindLevels[]` | `{ isBreak（必須）, blind1=SB, blind2=BB, blind3=ストラドル, ante, minutes }`（順序通り） |

応答から `tool_use` ブロックを取り出し（無ければ `INTERNAL_SERVER_ERROR: "AI did not return structured data"`）、`ExtractedTournamentDataSchema`（全項目 optional、`blindLevels` の各数値は nullable）で `safeParse`。失敗時は `INTERNAL_SERVER_ERROR: "Failed to parse AI response"`。検証済みデータをそのまま返す。

#### `extractTablePlayers`

`sources` は画像（または画像 URL）ちょうど1件。`sourceApp` に対応する設定（`TABLE_PLAYER_SOURCE_APPS`）からプロンプトを取得し、`client.messages.parse` の `output_config.format = zodOutputFormat(ExtractedTablePlayersSchema)` で構造化出力を直接得る（`max_tokens: 1024`）。

`ExtractedTablePlayersSchema` = `{ seats: array(default []) }`、各 seat = `{ seatNumber: int 1..9, name: min(1), isHero: boolean | null }`。`parsed_output` が無ければ `INTERNAL_SERVER_ERROR`。返却前に `seatNumber` で重複排除（先勝ち）。

#### AI 抽出ソース定義（`ai-extract-sources.ts`）

`extractTablePlayers` がサポートする外部アプリのレジストリ。現在の登録 ID は `"dmm_waitinglist"`（`TABLE_PLAYER_SOURCE_APP_IDS`）の1件のみ。各エントリは `{ label, prompt }` を持つ。

`dmm_waitinglist` のプロンプト（英語）は DMM Waitinglist アプリのテーブル画像を解釈する規則を定義する: 画面下中央のノッチがある席を seat 1 とし時計回りに採番、画面上部に表示されるユーザー名と一致する座席を `isHero: true`（自信が持てない場合は全座席 `isHero: null`、true は高々1席）、読み取れない/空席は除外、装飾やスタック表示を除去、日本語（ひらがな/カタカナ/漢字）・英語・混在の名前を原文のまま保持（翻訳・ローマ字化しない）。

なお `extractTablePlayers` のセッション側 `MAX_SEAT_NUMBER` は 9（座席番号の上限）であり、着席ルーターの `seatPosition`（0 始まり 0..8）とは別の 1 始まり番号体系である点に注意。

## 9. ドメイン・計算ロジック

### 定数 (packages/db/src/constants)

#### `session-event-types.ts` — ライブセッションのイベント型ドメイン

ライブセッション中に記録される「イベント」の型・ペイロード・状態遷移を一元定義する。サーバ／クライアント共通の真実の源。

**イベント型カテゴリ（定数配列）:**

| 定数 | 値 | 用途 |
|---|---|---|
| `SESSION_STATUSES` | `active`, `paused`, `completed` | セッション状態 |
| `LIFECYCLE_EVENT_TYPES` | `session_start`, `session_end` | ライフサイクル（手動作成不可） |
| `PAUSE_RESUME_EVENT_TYPES` | `session_pause`, `session_resume` | 中断／再開 |
| `CASH_EVENT_TYPES` | `chips_add_remove`, `all_in` | キャッシュゲーム専用 |
| `TOURNAMENT_EVENT_TYPES` | `purchase_chips` | トーナメント専用 |
| `COMMON_EVENT_TYPES` | `update_stack`, `player_join`, `player_leave`, `memo` | 両タイプ共通 |
| `ALL_EVENT_TYPES` | 上記すべてを spread した和集合 | 全11種 |
| `MANUAL_CREATE_BLOCKED_EVENT_TYPES` | `session_start`, `session_end` | 手動作成禁止（ライフサイクルによる自動生成のみ） |

**ペイロード Zod スキーマと制約（全列挙）:**

| スキーマ | フィールド | 型・制約 | 備考 |
|---|---|---|---|
| `cashSessionStartPayload` | `buyInAmount` | `int >= 0` | キャッシュ開始 |
| `tournamentSessionStartPayload` | `timerStartedAt` | `int`, nullable, optional | トナメ開始（タイマー起点 Unix秒） |
| `cashSessionEndPayload` | `cashOutAmount` | `int >= 0` | キャッシュ終了 |
| `tournamentSessionEndPayload` | `beforeDeadline` で判別される discriminated union | `false`枝: `placement(int>=1)`, `totalEntries(int>=1)`, `prizeMoney(int>=0)`, `bountyPrizes(int>=0)` / `true`枝: `prizeMoney`, `bountyPrizes` のみ | 締切前終了は順位/エントリ数を持たない |
| `sessionPausePayload` / `sessionResumePayload` | （なし） | 空オブジェクト | |
| `chipsAddRemovePayload` | `amount` | `int`, **0 を refine で拒否**（`"amount must be non-zero"`） | **符号付き**: 正=チップ追加、負=早期キャッシュアウト。ゼロは no-op イベントとして拒否 |
| `allInPayload` | `potSize(>=0)`, `trials(int>=1)`, `equity(0..100)`, `wins(>=0)` | | EV計算用。`equity` は百分率 |
| `purchaseChipsPayload` | `sessionChipPurchaseId(min1)`, `name(min1)`, `cost(int>=0)`, `chips(int>=0)` | | name/cost/chips はルール変更後も表示・PL計算に使う非正規化スナップショット |
| `chipPurchaseCountSchema` | `name(min1)`, `count(int>=0)`, `chipsPerUnit(int>=0)` | | チップ購入回数の集計単位 |
| `updateStackPayload` | `stackAmount(int>=0)`, `remainingPlayers(int>=1, nullable, optional)`, `totalEntries(int>=1, nullable, optional)`, `chipPurchaseCounts(配列, optional)` | | キャッシュ／トナメ共有。`averageStack` は読み取り時に導出されるため**ペイロードに保存しない** |
| `playerJoinPayload` | `playerId(min1, optional)`, `isHero(bool, default false)`, `seatPosition(int, 0..8, optional)` | | 座席は 0–8（9-max） |
| `playerLeavePayload` | `playerId(min1, optional)`, `isHero(bool, default false)` | | |
| `memoPayload` | `text(min1)` | | |

**ペイロードスキーママップ:**
- `SESSION_START_PAYLOAD_SCHEMAS` / `SESSION_END_PAYLOAD_SCHEMAS`: `{ cash_game, tournament }` でセッションタイプ依存スキーマを引く。
- `EVENT_PAYLOAD_SCHEMAS`: `session_start`/`session_end` を除く9種を網羅した `Record`。

**公開関数:**

| 関数 | 入力 | 出力・ロジック |
|---|---|---|
| `validateEventPayload(eventType, payload, sessionType?)` | イベント型, 未検証ペイロード, セッションタイプ | `session_start`/`session_end` はタイプ別スキーマで `parse`（`sessionType` 未指定時のデフォルトは **`tournament`**）。それ以外は `EVENT_PAYLOAD_SCHEMAS` で `parse`。失敗時 Zod が throw |
| `isValidEventTypeForSessionType(eventType, sessionType)` | | ライフサイクル/中断再開/共通は常に `true`。`cash_game` なら `CASH_EVENT_TYPES`、`tournament` なら `TOURNAMENT_EVENT_TYPES` に含まれるか。どれにも該当しなければ `false` |
| `getSessionCurrentState(events)` | `{ eventType, occurredAt, sortOrder }[]` | `session_end` が1件でもあれば `completed`。`session_start`/`session_pause`/`session_resume` を抽出し、**0件なら `active`**。`occurredAt` 降順→同時刻なら `sortOrder` 降順で最新を取り、最新が `session_pause` なら `paused`、それ以外は `active` |
| `isEventAllowedInState(eventType, state)` | | `completed` は常に `false`。`paused` は `memo`/`session_resume`/`session_end` のみ許可。`active` は キャッシュ+トナメ+共通イベント+`session_pause`+`session_end` を許可（`session_start` は手動作成されないためチェック対象外） |

#### `player-tag-colors.ts` — プレイヤータグの色ドメイン

`TAG_COLOR_NAMES`（8色: `gray, red, orange, yellow, green, blue, purple, pink`）と各色の Tailwind クラス対（`bg`/`text`、light/dark）を `TAG_COLORS` で定義。ロジックは持たず色名の列挙と class マッピングのみ。

### ページネーション (packages/api)

#### `_pagination.ts` — `paginate<T extends { id: string }>(rows, pageSize)`

「`pageSize + 1` 件取得して番兵をスライスする」カーソルページネーションの純粋関数。

- `hasMore = rows.length > pageSize`。
- `hasMore` のとき `items = rows.slice(0, pageSize)`、`nextCursor = items.at(-1)?.id`。そうでなければ `items = rows`、`nextCursor = undefined`。
- 空配列・`pageSize` ちょうどの場合は `nextCursor` が `undefined` になる。

### 汎用フォーマッタ／ヘルパ (apps/web/src/utils)

#### `format-number.ts`

| 関数 | 入出力 | 変換ルール・エッジケース |
|---|---|---|
| `formatCompactNumber(value)` | `number → string` | 絶対値の閾値で単位付与: `>= 10^10`→`B`, `>= 10^7`→`M`, `>= 10^4`→`k`。各々 `toFixed(1)` 後に末尾 `.0` を除去（`/\.0$/`）。閾値未満は `toLocaleString()`（桁区切り）。**閾値はすべて 10,000 起点**（例: 10000 → `10k`） |
| `createGroupFormatter(values)` | `(number|null|undefined)[] → (number)=>string` | グループ内の**最大絶対値**で単位 tier（B/M/k）を一意に決め、全要素へ一律適用（例: max=10000 なら 100→`0.01k`）。`null`/`0` は除外して max を計算、max<10000 または有効値なしなら全要素を素の `toLocaleString()` |
| `formatYmdSlash(input)` | `string|Date → string` | ローカル日付を `YYYY/MM/DD`。月日は `padStart(2,"0")` |

#### `format-profit-loss.ts`

| 関数 | ロジック |
|---|---|
| `formatProfitLoss(value, { currencyUnit?, nullDisplay? })` | `null`/`undefined` → `nullDisplay ?? "—"`。`>= 0` のとき `+` 符号付与（負はそのまま）。本体は `formatCompactNumber`。`currencyUnit` があれば ` 単位` を後置 |
| `profitLossColorClass(value)` | `null`/`undefined`/`0` → `""`（無色）。正 → 緑、負 → 赤の Tailwind クラス |

#### `format-elapsed-time.ts` — `formatElapsedTime(startedAt)`
`null`/`undefined` → `"—"`。`Date.now() - start` を計算し、`NaN` または**負（未来日時）なら `"—"`**。総分を `Math.floor(diffMs/60000)`、時=`floor(分/60)`、分=`分%60`。`時>0` のとき `"Nh Mm"`、それ以外 `"Mm"`。

#### `optimistic-update.ts` — 楽観的更新の共通ルール（強制ヘルパ群）

TanStack Query キャッシュへの楽観的書き込みは**必ずこのファイル経由**（直接の `setQueryData + invalidateQueries` 連鎖は禁止）。

| 関数 | 役割・不変条件 |
|---|---|
| `cancelTargets(qc, targets[])` | 各ターゲットの in-flight クエリを並列 `cancelQueries`（`onMutate` 冒頭） |
| `invalidateTargets(qc, targets[])` | 各ターゲットを並列 `invalidateQueries`（`onSettled`） |
| `snapshotQuery(qc, queryKey)` | 単一クエリの現データを `{ kind:"query", queryKey, data }` で退避 |
| `snapshotQueries(qc, filters)` | フィルタ一致の全エントリを `{ kind:"queries", entries }` で退避 |
| `updateInfiniteQueryItems(qc, key, updateItems)` | `useInfiniteQuery` の**全ページの `items`** を写像。ページ封筒（`nextCursor` 等）を保持。キャッシュ未取得（`old` falsy）なら no-op（実体を捏造しない） |
| `updateQueryEntity(qc, key, patch)` | 単一オブジェクトキャッシュへ `patch`（部分オブジェクト or 現値を引数に取る関数）を浅マージ。`old` が falsy なら no-op |
| `updateQueryItems(qc, key, updateItems)` | プレーン配列キャッシュ全体を写像（edit=`map`/delete=`filter`）。未取得なら no-op |
| `prependInfiniteQueryItem(qc, key, item)` | 先頭ページの `items` 先頭へ追加。`pages` 長0 または未取得なら no-op |
| `restoreSnapshots(qc, snapshots[])` | `null`/`undefined` をスキップしつつ、`kind` 別に `setQueryData` でロールバック（`onError`） |

`OptimisticTarget` は `{ queryKey }` か `{ filters }` のどちらか。共通則: 「**未取得キャッシュへは何も書かない**（`onSettled` の invalidate が後で埋める）」「ページ封筒を壊さず `items` だけ書き換える」。

#### `table-size-colors.ts`
`TABLE_SIZE_COLORS`: テーブルサイズ 2–10 に固有 Tailwind クラスを対応付け。`getTableSizeClassName(size)` は未定義サイズで `"bg-muted text-muted-foreground"` にフォールバック。

### ルーム／ブラインド構造 (apps/web/src/features/rooms/utils)

#### `blind-level-helpers.ts` — ブラインドレベルの生成／補完／並べ替え

`BlindLevelRow` は `{ id, tournamentId, level, isBreak, blind1..3, ante, minutes }`。

| 関数 | ロジック・エッジケース |
|---|---|
| `parseIntOrNull(value)` | 空文字 → `null`。`parseInt(_,10)` し `NaN` → `null` |
| `getEffectiveLastMinutes(lastMinutes, levels)` | `lastMinutes != null` ならそれ。さもなくば**末尾から逆走**して最初に見つかった非 null `minutes` を返す（直前レベルの分数を新規レベルへ継承するため）。見つからなければ `null` |
| `reorderLevels(levels, dndEvent)` | `over` 無し or 同一 id なら `null`（変更なし）。`active`/`over` の index を引き、どちらか `-1` なら `null`。`arrayMove` 後に `level` を `i+1` で**振り直す** |
| `addLevel(levels, effectiveLastMinutes, isBreak)` | 末尾に新規行を追加。`id=crypto.randomUUID()`, `level=length+1`, ブラインド/ante は `null`, `minutes=effectiveLastMinutes` |
| `deleteLevel(levels, id)` | 該当 id を `filter` で除外後、`level` を `i+1` で再採番 |
| `updateLevel(levels, id, updates)` | 該当 id のみ `updates` を浅マージ |
| `createLevel(levels, vals, effectiveLastMinutes)` | `vals` の値で行作成。`minutes = vals.minutes ?? effectiveLastMinutes`、`blind3` は常に `null` |

#### `game-format.ts`

| 関数 | ロジック |
|---|---|
| `formatRingGameBlinds(game, currencyUnit?)` | `blind1/2/3/ante` で `createGroupFormatter` を作り一律フォーマット。`blind1` 在れば追加、`blind2` が null だが既に要素があれば `"—"` を挟む、`blind3` 在れば追加 → `"/"` 連結。ante は `anteType` が `bb`→`(BBA:…)`, `all`→`(Ante:…)`（`none`/`null` は無視）。本体/ante/通貨単位を空要素を除いて空白連結 |
| `formatTournamentBuyIn(tournament, currencyUnit?)` | `buyIn == null` なら `""`。`entryFee != null` なら `buyIn+entryFee`、それ以外 `buyIn` のみ。両者を `createGroupFormatter([buyIn, entryFee])` でフォーマットし通貨単位を後置 |

#### `merge-extracted-tournament-data.ts` — AI抽出結果のマージ規則（SA2-77）

`mergeExtractedTournamentData(extracted, base)`: AIが「空白」のフィールドはユーザ既入力を**上書きしない**。判定ヘルパ:
- `hasText`: trim 後非空の文字列のみ有効。
- `isMeaningfulNumber`: 有限かつ `>= 0`（フリーロールの buyIn/entryFee=0 を空白と区別して適用）。
- `isPositiveNumber`: 有限かつ `> 0`（`startingStack`/`tableSize` は実値が必ず正なので 0 は埋め草として無視）。

`name` は `hasText` なら採用、なければ `base.name ?? ""`。`variant` は `base.variant ?? "nlh"`。`buyIn`/`entryFee` は `isMeaningfulNumber`、`startingStack`/`tableSize` は `isPositiveNumber`、`chipPurchases` は非空配列のときのみ条件付き spread で上書き。AI非対象フィールド（`bountyAmount`/`currencyId`/`memo`/`tags`）は `base` のまま保持。

### 統計のクライアント側計算 (apps/web/src/features/statistics/utils)

#### `aggregate-pnl-points.ts` — 損益グラフの累積点生成

入力 `PnlSeriesPoint`（`{ profitLoss, sessionDate(Unix秒), type, bigBlind, buyInTotal, evProfitLoss, playMinutes, id }`）から累積系列 `AggregatedPoint[]` と `skippedCount` を作る。

**軸・単位ドメイン:**
- `xAxis`: `date` | `sessionCount` | `playTime`
- `unit`: `currency` | `normalized`
- `sessionType`: `all` | `cash_game` | `tournament`

**1点あたりの値変換（null=系列対象外）:**

| 関数 | ルール |
|---|---|
| `bbValue` | `cash_game` かつ `bigBlind > 0` のときのみ `profitLoss / bigBlind`、それ以外 `null` |
| `biValue` | `tournament` かつ `buyInTotal > 0` のとき `profitLoss / buyInTotal`、それ以外 `null` |
| `evCashValue(point, unit)` | `cash_game` かつ `evProfitLoss != null` 必須。`currency` ならそのまま、`normalized` は `bigBlind > 0` のとき `evProfitLoss / bigBlind`、不可なら `null` |

**集計ロジック（`aggregateSingle` / `aggregateDual` 共通の不変条件）:**
- 点は `sessionDate` 昇順、同時刻は `id` の `localeCompare` で安定ソート。
- 各点で値と evDelta が**両方 null ならスキップ**し `skippedCount++`。
- 累積（`cumulative`/`cashCumulative`/`tournamentCumulative`/`evCashCumulative`）に非nullデルタのみ加算。`sessionIndex++`、`cumulativeMinutes += playMinutes ?? 0`。
- X値の決定 `pickXValue`: `sessionCount`→`sessionIndex`、`playTime`→`cumulativeMinutes/60`（時間）、`date`→`startOfDayMs`（UTC日の0時、ミリ秒）。
- `date` 軸は**同日を Map で1点に畳み込み**（同日後勝ち）、最後に日付昇順で展開。
- 結果が非空なら先頭に**原点**を `unshift`。原点Xは `date` 軸で「初回セッション日の UTC0時 − 86,400,000ms（前日）」、その他軸で `0`。累積値は全系列 0。

**`aggregatePnlPoints(options)` のディスパッチ:**

| 条件 | 呼び出し | 系列 |
|---|---|---|
| `unit === "currency"` | `aggregateSingle(..., "currency", evApplies, "currency")` | 通貨単一系列 |
| `cash_game` (normalized) | `aggregateSingle(..., "bb", evApplies, "normalized")` | BB |
| `tournament` (normalized) | `aggregateSingle(..., "bi", false, "normalized")` | BI（EVは常にオフ） |
| `all` (normalized) | `aggregateDual(...)` | cash=BB / tournament=BI を**別系列で同時**保持 |

`evApplies = showEvCash && (unit==="currency" || sessionType!=="tournament")`（EVはトーナメント正規化には適用しない）。

#### `format-stats.ts` — 統計表示フォーマッタ

| 関数 | ルール |
|---|---|
| `formatMinutes(min)` | `null`/`<= 0` → `"0h"`。それ以外 `(min/60).toFixed(1)` の末尾0除去 + `"h"`（例 336→`5.6h`） |
| `formatPercent(value, digits=1)` | `null` → `"—"`、それ以外 `value.toFixed(digits)+"%"`（入力は既に 0–100） |
| `formatFixed(value, digits=1)` | `null` → `"—"`、それ以外 `toFixed(digits)` |
| `trendDirection(value)` | `null`/`0` → `null`、正 → `"up"`、負 → `"down"` |
| `decimalsForUnit(unit)` | `"bb"`→`1`, `"bi"`→`2`, その他→`0`（正規化単位の最小粒度） |
| `formatStatNumber(value, maxDecimals)` | 約4有効数字。`>= 1e9`→`B`, `>= 1e6`→`M`, `>= 1e4`→`/1000 k`。それ未満は `clampDecimals`（`4 - 整数桁` を 0..maxDecimals にクランプ）で `toFixed` 後に末尾0除去 |
| `formatStatAmount(value, unit, opts?)` | `null` → `nullDisplay ?? "—"`。`decimals = opts.decimals ?? decimalsForUnit(unit)`。`signed===false` または負以外は `+` 付与。`unit` があれば ` 単位` 後置 |
| `formatScopedProfitLoss(value, {normalized, unit})` | `normalized` なら `formatStatAmount`、否なら `formatProfitLoss`（桁区切り通貨） |

#### `stats-filters.ts` — 統計フィルタの正規化・URL スキーマ

- ドメイン: `STATS_NORMALIZATIONS = [off, normalized]`（**BB/BI は別スケールで決して合算しない**ので混在ビューでは並置）、`STATS_TYPES = [all, cash_game, tournament]`。
- `statsSearchSchema`（URL `validateSearch`）: `period`（`PERIODS`, default `all`）, `from`/`to`（`coerce.number().int().optional()`, Unix秒）, `currency?`, `norm`（default **`normalized`**）, `type`（default `all`）, `room?`。
- `parseStatsSearch(search)`: スキーマで `parse`。
- `filtersToStatsInput(filters, nowSec?)`: `resolveDateRange` で `dateFrom/dateTo` を解決。空文字フィルタは `|| undefined` で除去。`type==="all"`→`undefined`。`normalized = norm !== "off"`。
- `isCurrencyScopeValid({currency, norm})`: `norm !== "off"` または `currency` 真値（サーバの BAD_REQUEST ガードと対応）。
- `normalizedUnitForType(type)`: cash→`"bb"`, tournament→`"bi"`。
- `statsUnitFor(norm, type, currencyUnit)`: `off` なら通貨単位、否なら型の正規化単位。

`labels.ts` は `STATS_NORMALIZATION_LABEL`（`off→"Currency"`, `normalized→"BB / BI"`）と `STATS_TYPE_LABEL` の表示文字列マップのみ。

### 期間フィルタ共通ロジック (apps/web/src/shared/lib/period-filter.ts)

統計・セッション両フィルタが共有する日付/期間ドメイン（SA2-74）。`PERIODS = [7d, 30d, 90d, ytd, all, custom]`、`PERIOD_LABEL` で表示名。

| 関数 | ロジック |
|---|---|
| `resolveDateRange(filters, nowSec?)` | 期間を `{ dateFrom?, dateTo? }`(Unix秒) へ変換。相対窓は**UTC日境界にスナップ**（1日1回だけ値が変わりクエリキーが安定）。`7d/30d/90d`→`dayStart - N*86400` 〜 `dayEnd`(=今日の終わり、未来日除外)。`ytd`→`startOfUtcYearSec` 〜 `dayEnd`。`custom`→`from`/`to` をそのまま（未定義は欠落）。`all`/default→`{}` |
| `dateInputToEpochSec(value, endOfDay=false)` | `yyyy-mm-dd` 以外（正規表現不一致）→ `undefined`。`endOfDay` で `23:59:59`（上限を当日いっぱい含む）、否で `00:00:00`、UTC で Unix秒化 |
| `epochSecToDateInput(sec?)` | `undefined`→`""`、否なら `toISOString().slice(0,10)`（UTC `yyyy-mm-dd`） |

### 通貨残高・取引 (apps/web/src/features/currencies/utils)

#### `balance-format.ts`
- `getBalanceDisplay(balance)`: `compact = formatCompactNumber`、`exact = toLocaleString`。**compact が省略形でなければ `exact` は `null`**（同じ数字を二度出さない）。
- `getBalanceColorClass(balance)`: 残高は保有額（P/Lではない）なので正は中立(`""`)、**負（赤字）のみ `text-destructive`**。

#### `transaction-list-helpers.ts`
- `buildGroupFormatter(transactions)`: 取引額配列から `createGroupFormatter`。
- `getAmountColorClass(amount)`: 取引額は P/L デルタなので `>= 0`→`text-success`、負→`text-destructive`（残高と違い貸方/借方で色分け）。
- `getAmountDisplay(amount, fmt)`: `>= 0` で `+` を前置。
- `getDateDisplay(transactedAt)`: `formatYmdSlash`。
- `groupTransactionsByDate(transactions)`: **連続する**同日行のみ1グループに併合（リストは `transactedAt` 降順前提なので、後に再出現した同日は別グループ）。入力順保持、key は `"ラベル-index"`。

### セッション表示・フォーム (apps/web/src/features/sessions/utils)

#### `session-display.ts` — セッション詳細／一覧の表示行ビルダ

| 関数 | ロジック・エッジケース |
|---|---|
| `getSessionGameName(session)` | トナメ&名前あり→`tournamentName`、cash&名前あり→`ringGameName`、なければ `"Tournament"`/`"Cash game"` |
| `isLiveSession({source})` | `source === "live"` |
| `formatSessionDuration(startedAt, endedAt, breakMinutes?)` | どちらかの端点が無ければ `null`（行を省略）。`(endedAt - startedAt - breakMs)/3600000` を `toFixed(1)+"h"`。**休憩分を差し引いた正味時間** |
| `buildCashRuleRows` | variant/blinds(+ante)/table をそれぞれ値があるときのみ行追加（空行を作らない）。blinds は `formatBlindParts`、table は `"N-max"` |
| `buildCashStatRows` | `buyIn`/`cashOut` が `null` でなければ `formatCompactNumber` で行追加 |
| `buildTournamentRuleRows` | variant/buyIn/entryFee/startingStack/table。**`entryFee` は `> 0` のときのみ**（0は省略）、他は `!= null` で追加 |
| `buildTournamentStatRows` | `prizeMoney`/`bountyPrizes` は **`> 0`** のみ。chipPurchases は `count > 0` のものを `"count × cost"` 行に。placement は `totalEntries` 有無で `"順位 / 総数"` か `"順位"` |
| `buildSessionMetaRows` | `Date` は常に。room/currency/duration は条件付き |
| `formatTournamentResult(session)` | cash または placement null → `null`。`totalEntries` 有無で `"順位 / 総数"` か `"順位"` |
| `formatSessionPlDisplay(session, bbBiMode)` / `formatSessionEvDisplay(...)` | BB/BI トグル対応の中核 `formatPlValue` 経由（下記） |

**`formatPlValue(value, session, bbBiMode)`（BB/BI正規化）:**
- `bbBiMode` オフ → `formatProfitLoss`（通貨）。
- トーナメント: `toBI(value, totalCost)`、`totalCost = (tournamentBuyIn ?? 0) + (entryFee ?? 0) + chipPurchaseCost`。`totalCost === 0` なら BI 不能で通貨へフォールバック。`formatBBBI(_, "BI")`（小数2桁）。
- キャッシュ: `toBB(value, ringGameBlind2)`。`blind2` が `null`/`0` なら通貨へフォールバック。`formatBBBI(_, "BB")`（小数1桁）。
- `formatBBBI` は `value >= 0` で `+` 前置。
- `formatSessionEvDisplay`: cash 以外 or `evProfitLoss === null` なら `null`。EV は小数あり得る（ライブのオールイン equity）ため **`Math.round` してから**フォーマットし、表示精度を実現損益と揃える。

#### `session-form-helpers.ts` — セッション登録フォームの値域とマスタ差分

- 入出力ヘルパ: `getTodayDateString()`（ローカル `yyyy-mm-dd`）、`numStrOrEmpty(value)`（`undefined`→`""`, 否→`String`）、`parseOptInt(value)`（`""`→`undefined`、有限でない→`undefined`）。`NONE_VALUE = "__none__"`。
- `sessionFormSchema`: 全数値フィールドは `optionalNumericString({ integer:true, min:0 })`、ただし `placement`/`totalEntries` は `min:1`。`sessionDate` は `min(1,"Date is required")`。
- `buildDefaults(defaults?)`: 各フィールドへデフォルト適用。`variant` 既定 `"nlh"`、`anteType` 既定 `"none"`、`beforeDeadline` は `=== true` で真偽化。数値は `numStrOrEmpty`、`tableSize` は `toString()`。
- `cashOverriddenFields(values, master)` / `tournamentOverriddenFields(values, master)`: マスタ未選択なら `[]`。`[ラベル, 現フォーム値, マスタ値(文字列化)]` のタプル配列を作り、**`a !== b` のラベルだけ**返す（master の null は `numStrOrEmpty(... ?? undefined)` で `""` 化、variant は `?? "nlh"`、anteType は `?? "none"`）。マスタからのオーバーライド項目をユーザに提示するため。

#### `session-filters-helpers.ts`
セッション一覧フィルタのドメイン定数。`SESSION_PERIODS`/`SESSION_PERIOD_LABEL` は period-filter を再エクスポート（統計と挙動を一致させる, SA2-74）。`SESSION_TYPE_VALUES = [all, cash_game, tournament]`、`SESSION_DISPLAY_VALUES = [currency, normalized]` と各ラベルマップ。

#### `share-session.ts` — セッション結果のシェアテキスト生成
- `formatCompactNumberForShare(value)`: 共有専用の簡易整形。`>= 1e6`→`M`(1桁), `>= 1000`→`K`(1桁), 未満は `Math.round`。
- `formatOrdinal(n)`: 英語序数（`st/nd/rd/th`、`%100` で 11–13 を `th` に補正）。
- `formatDuration(startedAt, endedAt)`: 端点欠落で `null`、否なら `(差/3600000).toFixed(1)+"h"`（休憩は引かない）。
- `createSessionShareText(session)`: 絵文字付き複数行テキストを生成。日付は `toLocaleDateString("ja-JP")`。P/L 行 `buildProfitLossLine` はトナメで `prizeMoney > 0` のとき `(Prize: …)`、キャッシュで `evProfitLoss != null` のとき `(EV: …)` と `formatDuration` を付加。`profitLoss` の符号で 📈/📉。
- `shareSession(session)`: `navigator.share` があれば共有、無ければ `clipboard.writeText`。

### ライブセッションの計算ロジック (apps/web/src/features/live-sessions/utils)

#### `optimistic-session-event.ts` — イベント追加の楽観的更新ルール

イベント発火時に session summary / status / 一覧を即時更新する共通ビルダ群。

**`buildOptimisticSessionSummary(summary, eventType, payload, occurredAt?)`** — `summary` をコピーし、イベント別に更新:

| eventType | 更新内容 |
|---|---|
| `session_start` | `payload.buyInAmount` を `summary.totalBuyIn` に |
| `session_end` (cash) | `cashOut = cashOutAmount`、`profitLoss = cashOutAmount - (totalBuyIn ?? 0)` |
| `session_end` (トナメ `beforeDeadline===false`) | `placement`/`totalEntries` を反映、`profitLoss = prizeMoney + (bountyPrizes ?? 0)` |
| `session_end` (トナメ `beforeDeadline===true`) | `profitLoss = prizeMoney + (bountyPrizes ?? 0)` のみ |
| `update_stack` | `currentStack`/`remainingPlayers`/`totalEntries` を反映。`startingStack && totalEntries && remainingPlayers>0` のとき `averageStack = Math.round((startingStack*totalEntries + chipTotal)/remainingPlayers)`（`chipTotal = Σ count*chipsPerUnit`） |
| `all_in` | `potSize/equity/trials/wins` が全数値かつ `trials>0` のとき `evDiff += potSize*(equity/100) - (potSize/trials)*wins`（EV差分の累積） |
| その他（`chips_add_remove`/`memo`/`session_pause`/`session_resume`/`purchase_chips`/`player_join`/`player_leave`） | summary 更新なし（`chips_add_remove` の `totalBuyIn` 反映はサーバ側） |

`occurredAt` があれば `lastUpdatedAt` を更新。

**その他の関数:**
- `deriveOptimisticStatus(current, eventType)`: `session_pause`→`paused`, `session_resume`→`active`, `session_end`→`completed`, 他は現状維持。
- `buildOptimisticEvent(eventType, payload)`: `id="optimistic-<Date.now()>"`, `occurredAt=now ISO` の仮イベント。
- `getSessionQueryKeys(sessionId, sessionType)`: cash/tournament 別に `sessionKey/eventsKey/activeListKey/pausedListKey/allListsKey` を生成。
- `createSessionEventMutationOptions(config)`: `onMutate` で cancel→snapshot→イベント末尾追加→summary/status 更新→（`changesStatus` 時）active/paused 一覧間移動、`onError` で `restoreSnapshots`、`onSettled` で session/events/全一覧を invalidate。`optimisticListStatusUpdate` は移動元から該当 item を抜き、移動先の先頭へ `status` 付きで挿入。

#### `session-timeline.ts` — イベントストリームからの損益／スタック曲線

`session_start` が無ければ両関数とも `[]`。時刻はすべて `toMs` で正規化、`anchor`（開始時刻）からの相対ミリ秒 `t` を使う。

**`deriveCashGameTimeline(events)` → `{ t, pl, evPl }[]`:**
- アキュムレータ `{ stack, totalBuyIn, chipRemoveTotal, evDiff }`。
- 各点の損益 `pl = stack + chipRemoveTotal - totalBuyIn`、`evPl = pl + evDiff`。
- `session_start`: `stack += buyInAmount`, `totalBuyIn += buyInAmount` → 点を打つ。
- `update_stack`: `stack = stackAmount` → 点を打つ。
- `chips_add_remove`: 正なら `totalBuyIn`/`stack` に加算、負なら `chipRemoveTotal` に絶対値加算・`stack` から減算。**点は打たない**（次の update_stack/session_end に反映）。
- `all_in`: `evDiff += potSize*(equity/100) - (potSize/trials)*wins`。**点は打たない**。
- `session_end`: `stack = cashOutAmount` → 点を打つ。
- ペイロードは各 Zod スキーマで `parse`（不正は throw）。

**`deriveTournamentTimeline(events)` → `{ t, stack, averageStack }[]`:**
- `findTournamentStartingStack`: 開始以降で最初の `update_stack` の `stackAmount`（無ければ `null`）。
- `averageStack = (startingStack*totalEntries)/remainingPlayers`、いずれか null または `remainingPlayers <= 0` なら `null`。
- `session_start`: `startingStack`/`stack` を上記開始スタックに（0 fallback）→ 点を打つ。
- `update_stack`: `stack=stackAmount`、初回なら `startingStack` も設定、`totalEntries`/`remainingPlayers`/`chipPurchaseCounts` を反映 → 点を打つ。
- `purchase_chips`: `stack += chips`。**点は打たない**（次の update_stack に反映）。
- `session_end` (`beforeDeadline===false`): `totalEntries` 反映、`stack = placement===1 ? totalChipsInPlay : 0`（`totalChipsInPlay = startingStack*totalEntries + Σ count*chipsPerUnit`）→ 点を打つ。

#### `tournament-timer.ts` — ブラインドタイマー状態の算出

**`computeTournamentTimerState(blindLevels, timerStartedAt, now=Date.now())` → `TournamentTimerState`:**
- `elapsedSeconds = max(0, floor((now - start)/1000))`（負を切り上げ）。
- レベルは `level` 昇順ソート。`totalDurationSeconds` は**全レベルの `minutes` が数値かつ `>= 0` のときのみ** `Σ minutes*60`、欠損があれば `null`。
- 各レベルの終端 `cumulative + minutes*60` を進め、`elapsed < 終端` の最初のレベルを「現在」として `remainingSecondsInLevel = 終端 - elapsed`、`levelProgressFraction = clamp(0..1, 経過/総)` を返す。`minutes` が数値でない/`<= 0` のレベルは進捗・残り時間 `null` でそこを現在レベルとして即返す。
- 全レベルを過ぎたら最終レベルを現在とし、`remainingSecondsInLevel=0`、`levelProgressFraction=1`(分数値あり時)、`nextLevel=null`。レベル空なら `currentLevelIndex=-1`。
- `formatTimerDuration(seconds)`: `max(0, floor)`、`時>0` で `H:MM:SS`、否で `MM:SS`（分秒 `padStart(2,"0")`）。
- `formatBlindLevelLabel(level)`: break は `"Break (L<level>)"`、否は `"L<level> b1/b2/b3 (ante N)"`（ブラインド無しは `"—"`、ante は真値時のみ）。
- `formatBlindsValue(level)`: 非 null ブラインドを `" / "` 連結、無ければ `"—"`。

#### `session-events-formatters.ts` — イベントの表示ラベルと要約・グルーピング
- `EVENT_TYPE_LABELS` / `formatEventLabel(eventType)`: 各イベント型の人間可読ラベル（未知はそのまま返す）。`LIFECYCLE_EVENTS = Set{session_start, session_end}`。
- `formatPayloadSummary(eventType, payload)`: ペイロードがオブジェクトでなければ `null`。型別サマライザ `PAYLOAD_SUMMARIZERS` を引く。例: `chips_add_remove`→`amount<0` で `"Remove: N"`/否 `"Add: N"`、`update_stack`→`"Stack: N · remaining/total"`（片側欠損は `-` 表記）、`all_in`→`"Pot: N · Equity: E%"`、`memo`→trim 後 60文字超で `…` 省略、`session_start`→`buyInAmount` か `timerStartedAt`(時刻 `HH:MM`)、`session_end`→cashOut/締切前/順位など。
- `getTimeBounds(events, targetId)`: 対象イベントの前後イベントの `occurredAt` を `{ minTime, maxTime }` として返す（時刻編集の許容範囲）。端なら片側 `null`。
- `groupEventsForDisplay(events)`: 連続する `player_join`/`player_leave` のクラスタが**2件以上なら `player_group`**、1件なら `single`。それ以外は `single`。

#### `snapshot-diff.ts` — ライブセッションのスナップショット vs マスタ差分
- `diffCashSnapshot(snap, master)` / `diffTournamentSnapshot(snap, master)`: `master` が null なら `{}`。各フィールドを `!==` 比較した `Partial<Record<…, boolean>>`（`true`=差異）。cash: ruleName(↔name)/variant/blind1-3/ante/anteType/minBuyIn/maxBuyIn/tableSize。tournament: ruleName/variant/buyIn/entryFee/startingStack/bountyAmount/tableSize。
- `diffBlindLevels(snap, master)`: master null→`false`。長さ違い→`true`。各レベルの `isBreak/blind1-3/ante/minutes` のいずれか相違で `true`。
- `diffChipPurchases(snap, master)`: master null→`false`。長さ違い→`true`。各要素の `name/cost/chips` 相違で `true`。

「Modified」バッジ表示のためにセッション個別オーバーライドを検出する。

#### その他の純粋ヘルパ

| ファイル / 関数 | ロジック |
|---|---|
| `memo-excerpt.ts` `memoExcerpt(memo)` | リッチテキスト(HTML)メモを1行プレーンテキストに。`<br>`→空白、HTMLタグ除去、エンティティ復号（`&amp;`/`&lt;`/`&gt;`/`&nbsp;`/`&quot;`/`&#39;`）、空白連続を1つに、trim。可視テキスト無し（空）なら `null` |
| `stack-editor-time.ts` | `toTimeInputValue(value)`→`HH:MM`。`applyTimeToDate(original, timeStr)`→元日付に時分を適用（秒/ミリ秒0）。`validateOccurredAtTime(...)`→`minTime`/`maxTime`（秒以下切捨て比較）を外れたら `"Must be after/before HH:MM"`、OK なら `null`。`toOccurredAtTimestamp(original, timeStr)`→欠損で `undefined`、否で適用後の Unix秒 |
| `tag-overflow.ts` `computeVisibleTagCount({availableWidth, gap, plusWidth, tagWidths})` | 1行に収まる先頭タグ数。0件→0。全部入るなら全件。入らなければ末尾 `+N` バッジ分(`gap+plusWidth`)を確保して収まる最大数。レイアウトエンジン無しで純関数化 |
| `create-tournament-session-form-helpers.ts` | `createTournamentSessionFormSchema`（`buyIn`/`startingStack` 必須数値`min0`、`entryFee` 任意`min0`、`memo`/`timerStartedAt` 文字列）。`parseTimerStartedAt(value)`→trim 後空なら `undefined`、`Date` 化し `NaN` なら `undefined`、否で `floor(ms/1000)` Unix秒 |
| `game-scene-formatters.ts` | `VARIANT_LABELS`/`variantLabel`（既知は表、未知は大文字化）。`formatBlindParts`/`formatAnteSuffix` は `game-format.ts` と同じブラインド整形ロジック（`createGroupFormatter` ベース、ante は `bb`→`(BBA:…)`/`all`→`(Ante:…)`） |
| `seat-screenshot.ts` | スクショ抽出プレイヤーのレビュー行ロジック。`fileToBase64`（dataURL のカンマ後を抽出）、`normalizeName`（trim+小文字）、`computeRowWarning`（`seatPosition` が 0–8 外で範囲警告、占有席で重複警告）、`computeRowAction`（preferred/hero候補/空名/既存マッチで `existing|new|hero|skip` を決定）、`buildRow`（名前正規化→マスタ照合で `ambiguous`(複数一致)/`matchedPlayer`(単一)を判定し行構築）、`applyRowAction`（hero 設定時は他行の hero を解除、ambiguous 行への `existing` 指定は無視）、`applyRow`（action 別に tRPC mutate、例外は `false`） |

`game-scene-formatters.ts` の `variantLabel`/`formatBlindParts`/`formatAnteSuffix` は `sessions/utils/session-display.ts` からも再利用され、ブラインド表記をライブと履歴で一致させている。

## 10. 機能仕様 - 部屋・通貨・プレイヤー

### 部屋 (Rooms)

#### 概要・データモデル

「部屋」はポーカー会場（カジノ／アミューズメント等）を表すトップレベルのエンティティで、配下に**リングゲーム（キャッシュゲーム卓）**と**トーナメント**をぶら下げる。すべての操作は認証ユーザー所有（`protectedProcedure`）に限定され、各 API は対象レコードの `userId` がセッションユーザーと一致するか検証し、不一致なら `FORBIDDEN`、未存在なら `NOT_FOUND` を返す。

部屋一覧 (`room.list`) が返すフィールド:

| フィールド | 型 | 補足 |
|---|---|---|
| `id` / `userId` / `name` / `memo` | — | `memo` は `null` 可 |
| `isFavorite` | boolean | お気に入りフラグ |
| `createdAt` / `updatedAt` | timestamp | |
| `ringGameCount` | number | **アーカイブされていない** リングゲーム数（相関サブクエリで集計） |
| `tournamentCount` | number | **アーカイブされていない** トーナメント数 |

一覧の並び順は `isFavorite DESC, createdAt ASC`（お気に入りが先頭、同条件内は作成順）。

#### 部屋に対する操作

| 操作 | API | 入力・バリデーション | 楽観的更新 |
|---|---|---|---|
| 一覧 | `room.list` | なし | — |
| 作成 | `room.create` | `name`（必須・1文字以上）、`memo`（任意） | あり（一覧末尾に temp 行を追加） |
| 編集 | `room.update` | `id`、`name`、`memo`。クライアントは memo クリア時に**明示的に `null`** を送る（`undefined`＝「変更しない」と区別するため） | あり（該当行を差し替え） |
| 削除 | `room.delete` | `id` | あり（該当行を除去）。削除後 `/rooms` へ遷移 |
| お気に入り切替 | `room.toggleFavorite` | `id` | あり。切替後にサーバの `ORDER BY is_favorite DESC, created_at ASC` を**クライアント側で完全再現**してソートし直す |

フォーム (`use-room-form`): `name` は `z.string().min(1, "Room name is required")`、`memo` は文字列。空文字の memo は送信時に `undefined` へ変換される。

#### リングゲーム（部屋配下のキャッシュゲーム卓）

リングゲームは `room.list` とは別に `ringGame.listByRoom`（`roomId`, `includeArchived`）で取得する。`use-ring-games` は **アクティブ用** と **アーカイブ用** の2クエリを管理し、アーカイブ表示は `showArchived` が true のときのみ `enabled` になる。

入力項目（`use-ring-game-form` のフォーム値 → API）:

| 項目 | フォーム型 | バリデーション / 既定 | API 型 |
|---|---|---|---|
| `name` | 文字列 | 必須・1文字以上（"Game name is required"） | `min(1)` |
| `variant` | 文字列 | 既定 `"nlh"`（空なら `"nlh"` にフォールバック） | `default("nlh")` |
| `blind1` / `blind2` / `blind3` | 数値文字列 | 任意・整数・min 0 | `int` |
| `ante` | 数値文字列 | 任意・整数・min 0。`anteType==="none"` のとき送信値は `undefined` に落とす | `int` |
| `anteType` | enum | `"all" | "bb" | "none"`、既定 `"none"` | `enum(["none","all","bb"])` |
| `minBuyIn` / `maxBuyIn` | 数値文字列 | 任意・整数・min 0 | `int` |
| `tableSize` | 文字列 | 任意（整数パース） | `int` |
| `currencyId` | 文字列 | 任意。空文字は `undefined` へ | 任意 |
| `memo` | 文字列 | 任意。空文字は `undefined` へ | 任意 |

数値入力は `type="number"` を使わず `inputMode="numeric"`＋Zod でパースする（`optionalNumericString`）規約に従う。

リングゲームに対する操作（すべて `use-ring-games` 内で楽観的更新）:

| 操作 | API | 振る舞い |
|---|---|---|
| 作成 | `ringGame.create` | アクティブ一覧末尾に temp 行を追加 |
| 編集 | `ringGame.update` | クリアされた（undefined）フィールドは**明示的に `null`** へマップしてサーバに送る（さもないと「フィールドのクリア」がノーオペになる）。アクティブ／アーカイブ両キャッシュに反映 |
| アーカイブ | `ringGame.archive` | `archivedAt` をセット。アクティブから除去しアーカイブ一覧へ移動 |
| 復元 | `ringGame.restore` | `archivedAt` を `null`。アーカイブから除去しアクティブへ移動 |
| 削除 | `ringGame.delete` | 両キャッシュから物理削除 |

`listByRoom` のフィルタは `includeArchived` で `archivedAt IS NULL`（アクティブ）／`IS NOT NULL`（アーカイブ）を切り替える。

#### トーナメント（部屋配下）

トーナメントはリングゲームと同じ active/archived の2クエリ構成 (`tournament.listByRoom`) を持ち、加えて**ブラインドレベル構成・チップ購入（リバイ/アドオン）・タグ**という子コレクションを持つ。一覧の各行は次を含む: `blindLevelCount`、`chipPurchases[]`（`{id,name,cost,chips,sortOrder}`、`sortOrder` 昇順）、`tags[]`（`{id,name}`）。

トーナメント本体の入力項目:

| 項目 | バリデーション / 既定 |
|---|---|
| `name` | 必須・1文字以上（"Tournament name is required"） |
| `variant` | 既定 `"nlh"` |
| `buyIn` / `entryFee` / `startingStack` / `bountyAmount` | 任意・整数・min 0 |
| `tableSize` | 任意（整数） |
| `currencyId` / `memo` | 任意 |
| `tags` | 文字列配列 |
| `chipPurchases` | `{name, cost, chips}` の配列（フォーム内では文字列、送信時に整数パース。パース不能は 0） |

トーナメント関連の操作と API:

| 操作 | API | 子コレクションの扱い |
|---|---|---|
| 一覧 | `tournament.listByRoom` | levels/tags/chipPurchases を N 件まとめて付与 |
| 単純作成 | `tournament.create` ＋ `tournament.addTag` ／ `tournamentChipPurchase.create` | `use-tournaments` の `create` は本体作成後にタグ・チップ購入を個別 mutate で同期 |
| 単純編集 | `tournament.update` | `syncTags`（差分追加/削除）と `syncChipPurchases`（既存を全削除→再作成）を実行 |
| レベル込み作成 | `tournament.createWithLevels` | 本体・tags・chipPurchases・blindLevels を1 mutation で一括作成。`tournament-tab` の `handleCreate` がこちらを使う |
| レベル込み編集 | `tournament.updateWithLevels` | 本体更新後、tags / chipPurchases / **blindLevels を全削除して再挿入**。`level` は配列順に 1 から振り直す |
| アーカイブ / 復元 / 削除 | `tournament.archive` / `restore` / `delete` | リングゲームと同じ active⇄archived 移動。物理削除あり |
| タグ追加 / 削除 | `tournament.addTag` / `removeTag` | 多対多ではなく**トーナメント専用のタグ行**（`tournamentTag`、文字列名のみ）。プレイヤータグとは別系統 |

タグ同期ロジック (`syncTags`): 新リストにあって既存にない名前を `addTag`、既存にあって新リストにない名前を `removeTag`。チップ購入同期 (`syncChipPurchases`): 既存 ID をすべて削除してから新リストを再作成（`sortOrder` は配列順）。

#### ブラインドレベル構成

トーナメントのブラインド構造は2系統で扱われる:

- **永続編集系** (`use-blind-levels`): 既存トーナメントのレベルを直接 API 操作。`blindLevel.create` / `update`（単一フィールド更新）/ `delete` / `reorder`（`levelIds` の順序で `level` を 1..n に再採番）。ドラッグ＆ドロップ並べ替えは `@dnd-kit`（PointerSensor: 8px 移動で起動、TouchSensor: 250ms 長押し）。レベル追加時は**直近に入力された `minutes` を引き継ぐ**（`effectiveLastMinutes`）。`isBreak` フラグでブレイク行を区別。
- **ローカル編集系** (`use-local-blind-structure` ＋ `blind-level-helpers`): 作成・レベル込み編集フォーム内で、保存前のローカル配列として操作（`addLevel` / `deleteLevel` / `updateLevel` / `createLevel` / `reorderLevels`）。削除・並べ替え時に `level` を 1 から振り直す。確定時にまとめて `createWithLevels` / `updateWithLevels` へ渡す。

ブラインドレベル各行: `{level, isBreak, blind1(SB), blind2(BB), blind3(Straddle), ante, minutes}`、すべて整数 nullable。`GAME_VARIANTS.nlh` がブラインドラベル（SB/BB/Straddle）を定義する。

#### AI によるトーナメント自動入力

`aiExtract.extractTournamentData` で、URL（最大5件）または画像（jpeg/png/gif/webp）からトーナメント情報を抽出してフォームへ流し込める（beta）。

- 入力ソース (`use-ai-extract-input`): URL 行＋画像で**合計最大5件**。URL に画像拡張子があれば画像として、それ以外は HTML を取得して Markdown 化（最大30,000字）して Claude に渡す。空 URL は無視、ソース0件なら送信しない。
- モデル `claude-opus-4-8` の tool_use で構造化抽出。抽出スキーマは `name / buyIn / entryFee / startingStack / tableSize / chipPurchases[] / blindLevels[]`（全項目省略可）。
- マージ規則 (`mergeExtractedTournamentData`, SA2-77): AI が返した**空白フィールドは既入力値を上書きしない**。`buyIn`/`entryFee` は明示的な `0`（フリーロール）も意味値として適用。`startingStack`/`tableSize` は `> 0` のみ適用（0 は埋め草とみなす）。`bountyAmount`/`currencyId`/`memo`/`tags` などの非 AI フィールドは `base` を保持。マージのベースは「現在のフォーム値」（`registerLiveValues` で取得）であり、ユーザーの途中入力を保護する。

---

### 通貨・取引 (Currencies & Transactions)

#### 概要・データモデル

「通貨」はバンクロールの口座単位（例: 現金、各アプリ内通貨）で、残高は**取引の合計**として算出される（`balance = COALESCE(SUM(amount), 0)`）。通貨一覧 (`currency.list`) のフィールド: `id`/`userId`/`name`/`unit`/`description`/`isFavorite`/`createdAt`/`updatedAt`/`balance`。並び順は部屋と同じく `isFavorite DESC, createdAt ASC`。

#### 通貨に対する操作

| 操作 | API | 入力・バリデーション | 楽観的更新 |
|---|---|---|---|
| 一覧 | `currency.list` | なし | — |
| 作成 | `currency.create` | `name`（必須・1文字以上）、`unit`（任意・**最大4文字**・印字可能 ASCII `[\x20-\x7e]` のみ）、`description`（任意・nullable・最大50,000字） | あり（末尾に temp 行、`balance: 0`） |
| 編集 | `currency.update` | 同上。`unit` クリア時は**明示 `null`** を送る | あり |
| 削除 | `currency.delete` | `id`。削除後 `/currencies` へ遷移 | あり |
| お気に入り切替 | `currency.toggleFavorite` | `id` | あり（サーバ順を再現してソート） |

`unit` バリデーション (`use-currency-form`): まず `.trim()` してから max 4 と ASCII 検査を行う（"Up to 4 characters" / "Half-width characters only"）。前後空白だけの unit は空＝任意扱いになる。`UNIT_MAX_LENGTH = 4`。

通貨説明 (`description`) は折りたたみ表示で、内容が高さ 160px（`DESCRIPTION_COLLAPSED_MAX_PX`）を超えるときのみ "Show more" トグルが現れる（`use-currency-description`、ResizeObserver で実測）。

#### 取引 (Transaction)

取引は通貨詳細でカーソルページネーション (`useInfiniteQuery`) で読み込む。`currencyTransaction.listByCurrency` は **1ページ10件**（`PAGE_SIZE = 10`）、`transactedAt DESC, id DESC` 順。カーソルは前ページ末尾行の `id` で、`(transactedAt, id)` タプル比較で順序整合を保つ（ランダム UUID 単独比較だと行の欠落/重複が起きるため）。

取引一覧行のフィールド: `id`/`currencyId`/`transactionTypeId`/`transactionTypeName`/`sessionId`/`sessionName`/`amount`/`transactedAt`/`memo`/`createdAt`。`sessionName` はセッション種別に応じ cash/tournament の `ruleName` を返す。

入力項目（`use-transaction-form` → API）:

| 項目 | バリデーション / 既定 |
|---|---|
| `amount` | 必須・数値文字列（`requiredNumericString`）。送信時 `Number()` で整数化（API は `z.number().int()`）。符号付き（プラス＝入金、マイナス＝出金）で、`amount >= 0` を `success`、`< 0` を `destructive` 色で表示 |
| `transactionTypeId` | 必須（"Type is required"）。`__new__`（新規作成）を選んだ場合は `newTypeName` が必須 |
| `transactedAt` | 必須（"Date is required"）。既定は当日（ISO `YYYY-MM-DD`） |
| `memo` | 任意。空文字は `undefined` へ |

取引に対する操作:

| 操作 | API | 楽観的更新 / 特記 |
|---|---|---|
| 追加 | `currencyTransaction.create` | 楽観なし。`onSettled` で通貨一覧（残高）と取引リストを invalidate |
| 編集 | `currencyTransaction.update` | 無限クエリキャッシュを楽観更新（`updateInfiniteQueryItems`）。`transactionTypeName` は refetch まで旧名のまま |
| 削除 | `currencyTransaction.delete` | 無限キャッシュから filter で除去 |

**業務制約**: `sessionId` が `null` でない取引（＝セッションから自動生成された取引）は**編集・削除ともに禁止**（`FORBIDDEN`、"Edit/Delete the session instead."）。

取引リスト表示ロジック (`transaction-list-helpers`): 連続する同日行を1つの日付グループに畳む（`groupTransactionsByDate`、入力は日付降順前提なので**連続する**同日のみ統合し、後で再出現した日付は別グループ）。

#### 取引種別 (Transaction Type)

取引種別はユーザーごとのマスタ。`transactionType.list` 初回アクセス時、種別が0件なら既定 **`["Purchase", "Bonus", "Session Result", "Other"]`**（`DEFAULT_TRANSACTION_TYPES`）を自動シードする。

| 操作 | API | バリデーション / 制約 |
|---|---|---|
| 一覧 | `transactionType.list` | 0件時に既定をシード |
| 作成 | `transactionType.create` | `name`（必須・1文字以上） |
| 編集 | `transactionType.update` | `id`, `name`（1文字以上） |
| 削除 | `transactionType.delete` | **取引で使用中の種別は削除不可**（`PRECONDITION_FAILED`、"Cannot delete: type is in use by transactions"） |

取引フォーム上では `"Session Result"` が**予約名**（`RESERVED_TYPE_NAMES`）として扱われ、種別選択肢から除外され、コンボボックスでこの名前の新規作成もできない。種別コンボボックス (`use-type-combobox`): 入力でフィルタ、完全一致なら選択、未一致かつ非予約なら "Create" を提示。Enter で完全一致を選択 or 新規作成、Escape で閉じる。新規作成を選ぶと送信時に `transactionType.create` を先に実行し、得た ID で取引を作る。

---

### プレイヤー・タグ (Players & Tags)

#### 概要・データモデル

「プレイヤー」は対戦相手等の人物記録で、**プレイヤータグと多対多**で関連付く（中間テーブル `playerToPlayerTag`、`position` で並び順を保持）。プレイヤー一覧 (`player.list`) は `isTemporary = false` のプレイヤーのみ返す（一時プレイヤーは除外）。各行に `tags[]`（`{id, name, color}`、`position` 昇順）が付く。

プレイヤー行フィールド: `id`/`userId`/`name`/`memo`/`isTemporary`/`createdAt`/`updatedAt`/`tags[]`。

#### プレイヤーに対する操作

| 操作 | API | 入力・バリデーション | 楽観的更新 |
|---|---|---|---|
| 一覧 | `player.list` | 任意 `search`（`name LIKE`）、`tagIds`（タグで絞り込み。中間テーブル経由で該当 playerId を解決） | — |
| 作成 | `player.create` | `name`（必須・1〜100文字）、`memo`（任意・最大50,000字）、`tagIds`（任意） | あり（末尾に temp 行、選択タグを付与） |
| 編集 | `player.update` | `id`, `name`(1〜100), `memo`(nullable・50,000), `tagIds`。`tagIds` を渡すと中間リンクを全削除して `position` 付きで再挿入 | あり。`use-player-detail` は詳細キャッシュと全プレイヤー一覧キャッシュの両方を楽観更新 |
| 削除 | `player.delete` | `id`。削除後 `/players` へ遷移 | あり |

フォーム (`use-player-form`): `name` は `min(1, "Name is required")`＋`max(100, "Name must be 100 characters or less")`、`memo` は nullable で最大50,000字。タグは0件なら `tagIds: undefined` を送る。

**検索の挙動** (`use-players-page`): プレイヤー一覧は**クライアント側で全件保持**し、検索はサーバ再クエリではなく取得済み配列を**プレイヤー名 or タグ名**でフィルタする（`NO_TAG_FILTER` でサーバの `tagIds` 絞り込みは使わない）。検索語は trim＋小文字化して部分一致。

#### プレイヤータグ

タグはユーザーごとのマスタで、`{id, name, color}` を持つ。色は固定8色から選ぶ enum:

| 色名 | 値 |
|---|---|
| `gray`（既定） / `red` / `orange` / `yellow` / `green` / `blue` / `purple` / `pink` | `TAG_COLOR_NAMES` |

| 操作 | API | バリデーション / 制約 |
|---|---|---|
| 一覧 | `playerTag.list` | ユーザー所有のタグ |
| 作成 | `playerTag.create` | `name`（必須・1〜50文字）、`color`（enum、**既定 `"gray"`**） |
| 編集 | `playerTag.update` | `id`, `name`(1〜50), `color`（いずれも任意） |
| 削除 | `playerTag.delete` | **削除前に中間テーブル `playerToPlayerTag` の該当リンクを全削除**してからタグ本体を削除（プレイヤーは残り、関連だけ外れる） |

タグ編集・削除の楽観的更新 (`use-player-tags`) は**タグ一覧と全プレイヤー一覧の両方**を更新する（タグのリネーム/色変更/削除がプレイヤー行のバッジに即時反映されるよう、各プレイヤーの `tags[]` も同時に map/filter）。

プレイヤーフォーム内でのタグ付与 (`PlayerTagInput` / `TagPickerBase`): 既存タグから選択、または**インラインで新規タグ作成**（`createTag` → `playerTag.create`、新規作成時の色は `"gray"`）。`use-player-detail` の `createTag` は楽観的に temp タグ（color `"gray"`）を一覧へ差し込む。

#### 一時プレイヤー（ライブセッション卓）

ライブセッションの卓席管理 (`use-table-players`) では、通常のプレイヤー一覧とは別系統 (`sessionTablePlayer.*`) でプレイヤーを扱い、**ポーリング間隔5秒**で同期する。卓への追加方法は3通り:

| 操作 | API | 内容 |
|---|---|---|
| 既存プレイヤー追加 | `sessionTablePlayer.add` | `playerId` と任意 `seatPosition` |
| 新規プレイヤー追加 | `sessionTablePlayer.addNew` | `playerName`＋任意 `playerMemo` / `playerTagIds` で新規作成と同時に着席。`onSettled` でプレイヤー一覧も invalidate |
| 一時プレイヤー追加 | `sessionTablePlayer.addTemporary` | 名前未確定の `isTemporary` プレイヤー（表示名 `"..."`）を着席 |
| 退席 | `sessionTablePlayer.remove` | `isActive=false`＋`leftAt` を設定（履歴 stint として残る） |
| 座席変更 | `sessionTablePlayer.updateSeat` | `seatPosition` を更新（`null` も可） |

すべて楽観的更新付き。アクティブな着席プレイヤーの ID は `excludePlayerIds` として返され、追加候補の重複排除に使われる。一時プレイヤーは `player.list`（`isTemporary=false` 条件）に出てこないため、通常のプレイヤー管理画面には現れない。

#### 一覧の取得元の違い（補足）

部屋／トーナメント横断のエンティティ選択用に `use-room-games`（`ringGame.listByRoom` / `tournament.listByRoom` を `roomId` 有効時のみ取得、`includeAll` でアーカイブ込み）と `useEntityLists`（部屋・通貨の `{id, name}` の軽量リスト）が用意されており、ライブセッション作成時のリングゲーム/トーナメント/通貨の割り当てに使われる。

## 11. 機能仕様 - セッション・ライブ・統計・設定

### セッション記録（手動セッション）

ユーザーがポーカーの1回のプレイ結果（収支・スタッフ）を手動で記録・閲覧・編集・削除する中核機能。ライブセッションを確定すると、ここに完了済みセッションとして合流する。

#### 提供する操作

| 操作 | 入口 | 業務ルール |
|---|---|---|
| 一覧表示 | セッション一覧ページ | `session.list` をカーソルページネーション（`useInfiniteQuery`）で取得。`fetchNextPage` は `hasNextPage && !isFetchingNextPage` のときだけ次ページを読む |
| 新規作成 | 一覧ページの作成シート | ウィザード（Master→Rules→Result）で入力。送信後にシートを閉じ、選択中ルームをリセット。楽観的に一覧先頭へ仮アイテム（`id: temp-...`、`source: "manual"`、`status: "completed"`）を挿入 |
| 詳細表示 | 一覧から遷移 | `session.getById`（一覧アイテムと同形）を取得 |
| 編集 | 詳細ページのアクションシート | 通常セッションは全フィールド更新。ライブ由来セッションは限定更新（後述） |
| 削除 | 詳細ページのアクションシート→確認ダイアログ | 削除確定後 `/sessions` へ遷移。一覧から楽観的に除外 |
| 共有 | 詳細ページ | `navigator.share` があれば共有、なければクリップボードへコピー。整形テキスト（後述） |
| 再オープン（reopen） | 詳細ページ（キャッシュゲームのライブ由来のみ） | `session.liveCashGameSessionId != null` のときだけ可能。`liveCashGameSession.reopen` 実行後 `/active-session` へ遷移 |
| タグ作成 | ウィザード／編集内 | `sessionTag.create` で新規タグを即時作成し選択へ追加 |

#### セッション種別と入力フィールド

セッションは `cash_game`（キャッシュ）と `tournament`（トーナメント）の2種で、それぞれ持つフィールドが異なる。

| 区分 | キャッシュ固有 | トーナメント固有 | 共通 |
|---|---|---|---|
| 結果 | `buyIn`（必須）, `cashOut`（必須）, `evCashOut`（任意） | `tournamentBuyIn`（必須）, `entryFee`, `placement`, `totalEntries`, `prizeMoney`, `bountyPrizes`, `beforeDeadline`(締切前敗退フラグ) | `sessionDate`(必須), `startTime`, `endTime`, `breakMinutes`, `memo`, `tagIds`, `roomId`, `currencyId`, `ruleName` |
| ルール（スナップショット） | `variant`(既定 `nlh`), `blind1`(SB)/`blind2`(BB)/`blind3`(ストラドル), `ante`, `anteType`(`none`/`all`/`bb`), `tableSize`, `minBuyIn`, `maxBuyIn`, `ringGameId` | `variant`, `startingStack`, `bountyAmount`, `tableSize`, `blindLevels[]`, `chipPurchases[]`, `tournamentId`, `timerStartedAt` | — |

#### 作成ウィザードの業務ルール

- ステップ構成はモードで切替: 手動（`manual`）= Master→Rules→Result、ライブ（`live`）= Master→Rules→Start。
- **Master ステップ**: ルーム → 既存のリングゲーム／トーナメント（マスター）を選択。選択するとそのマスターの定義値を Rules ステップ各フィールドへ自動展開（`applyRingGameDefaults` / `applyTournamentDefaults`）。トーナメントはブラインドレベル・チップパーチェスを別テーブルから非同期取得して展開（取得失敗は無視）。マスターに通貨が紐付くと通貨も自動選択。
- **Rules ステップ**: マスターから展開した値を上書き編集可能。マスター値と現在値が乖離したフィールドはオーバーライドとしてラベル列挙（`cashOverriddenFields` / `tournamentOverriddenFields`）。マスター未選択時はオーバーライド判定なし。これらの変更はセッションのスナップショットにのみ適用され、マスター（`ring_game`/`tournament`）は変更されない。
- **数値入力**: `<input type="number">` は使わず文字列入力 + Zod 変換。`anteType === "none"` のとき `ante` は `undefined` に落とす。`beforeDeadline === true` のとき `placement`/`totalEntries` は送らない。
- バリデーション（`sessionFormSchema`）: `sessionDate` 必須、各数値は整数・`min` 制約付き任意文字列（`placement`/`totalEntries` は `min: 1`、それ以外は `min: 0`）。

#### ライブ由来セッションの編集制約

`liveCashGameSessionId` または `liveTournamentSessionId` が非 null のセッションは「ライブ由来（live-linked）」。このとき編集は `buildLiveLinkedUpdatePayload` を使い、`memo` / `tagIds` / `roomId` / `currencyId` のみ更新可能（収支・ルールは変更不可）。通常セッションは `buildUpdatePayload` で全項目更新。

#### 一覧のフィルタと表示モード

| 軸 | 値 | 既定 |
|---|---|---|
| 種別 (`type`) | `all` / `cash_game` / `tournament` | all |
| 期間 (`period`) | `7d` / `30d` / `90d` / `ytd` / `all` / `custom` | all |
| カスタム期間 | `from` / `to`（Unix 秒、`custom` 時のみ） | — |
| ルーム (`roomId`) | ルーム選択 | — |
| 通貨 (`currencyId`) | 通貨選択 | — |
| 表示モード (`display`) | `currency`（通貨額）/ `normalized`（BB / BI） | currency |

- フィルタ確定は即時反映（ドラフト/適用ステップなし）。種別・ルーム・通貨は選択でシートを閉じ、`period` の `custom` 選択時のみシートを開いたままにして両端の日付を入力させる。
- 期間プリセットは UTC 日境界にスナップ（`resolveDateRange`）。クエリキーが1日1回しか変わらないようにし、上限は今日の終端なので未来日付の行は「直近N日」「YTD」から除外される。

#### 共有テキストの整形

`createSessionShareText` が絵文字付きテキストを生成。日付は `ja-JP` ロケール。キャッシュは収支・EV・プレイ時間（`startedAt`/`endedAt` 差から `x.xh`）、トーナメントは順位（序数 + `/ N entries`、`beforeDeadline` 時は `- / - entries`）と賞金を含める。金額は `1K`/`1M` の簡略表記。

---

### ライブセッション

進行中のポーカーをリアルタイム記録する機能。1イベントずつ追記していき、終了時に完了済みセッションへ確定する。`update_stack` の初期登録から始まり、`session_pause`/`session_resume` で中断・再開、`complete` で確定する。

#### ライフサイクル

```
作成(create) → [進行中: イベント追記 / pause⇄resume] → 終了(complete) → 確定(/sessions へ完了済みセッション)
                                                  ↘ discard(破棄) → /sessions
```

| フェーズ | 操作 | 詳細 |
|---|---|---|
| 開始 | キャッシュ: `liveCashGameSession.create`（`initialBuyIn` を初期バイインに使用、`cashOut` は無関係） | トーナメント: `liveTournamentSession.create` の直後に `update_stack` イベントを `stackAmount: startingStack` で1件作成。`startingStack` は必須（未指定時 0）。`timerStartedAt` をタイマー開始時刻として渡せる |
| 状態 | `active` / `paused` / `completed` | `useActiveSession` は cash/tournament × active/paused の4クエリを引き、進行中セッション（active 優先、なければ paused）を1つだけ返す |
| 進行中 | イベント追記（後述） | 状態は `liveCashGameSession.getById` / `liveTournamentSession.getById` を `refetchInterval: 5000`（5秒）でポーリング。各イベント追記は楽観的に events リスト・session summary・status・active/paused リスト間移動を更新し、失敗時はスナップショットへロールバック |
| 中断/再開 | `session_pause` → `paused`、`session_resume` → `active` | `changesStatus: true`。`deriveOptimisticStatus` で楽観的に状態遷移し、リスト間でセッションを移動 |
| 終了（確定） | キャッシュ: `liveCashGameSession.complete({ finalStack })`、トーナメント: `liveTournamentSession.complete(...)` | 成功後にライブ一覧と `session.list` を無効化し `/sessions` へ遷移 |
| 破棄 | `liveCashGameSession.discard` / `liveTournamentSession.discard` | 確定せず破棄、`/sessions` へ遷移 |
| 再オープン | キャッシュのみ `reopen` | 完了済みキャッシュセッションを再びライブへ戻し `/active-session` へ |

#### 扱えるイベント種別

イベントは `sessionEvent.create`（`payload` 付き）で記録。表示ラベルとペイロード要約は次の通り。

| eventType | 表示ラベル | ペイロード | 記録される操作（キャッシュ / トーナメント） |
|---|---|---|---|
| `update_stack` | Stack Update | `stackAmount`, (T)`remainingPlayers`, (T)`totalEntries`, (T)`chipPurchaseCounts[]` | スタック記録。トーナメントは残り人数・総エントリー・チップ購入数も任意で同時記録し、平均スタックを再計算 |
| `chips_add_remove` | Chips Add/Remove | `amount`（負値=Remove） | キャッシュのみ。チップ追加/除去。`addChip`/`removeChip`（removeは符号反転） |
| `all_in` | All-in | `potSize`, `trials`, `equity`(%), `wins` | キャッシュのみ。オールイン EV を記録。`evDiff += potSize×equity/100 − (potSize/trials)×wins`（trials>0 のとき） |
| `purchase_chips` | Purchase Chips | `sessionChipPurchaseId`, `name`, `cost`, `chips` | トーナメントのみ。アドオン/リバイ。チップ購入種別はセッション作成時のスナップショット（`session_chip_purchase`）から取得 |
| `memo` | Memo | `text`（1文字以上必須） | 両種。メモ追記 |
| `session_pause` | Session Pause | `{}` | 両種。状態を paused へ |
| `session_resume` | Session Resume | `{}` | 両種。状態を active へ |
| `session_start` | Session Start | `buyInAmount` / `timerStartedAt` | 開始イベント（要約に表示）。`buyInAmount` は `totalBuyIn` を確定 |
| `session_end` | Session End | (Cash)`cashOutAmount` / (T)`placement`,`totalEntries`,`prizeMoney`,`bountyPrizes`,`beforeDeadline` | 終了。キャッシュは `profitLoss = cashOut − totalBuyIn`、トーナメントは賞金合計で `profitLoss` を確定 |
| `player_join` | Player Join | `isHero`, `seatPosition` | 着席。連続する2件以上はグループ表示 |
| `player_leave` | Player Leave | `isHero` | 離席。連続する2件以上はグループ表示 |

イベントは編集（`sessionEvent.update`、時刻・ペイロード）と削除（`sessionEvent.delete`）が可能。編集時刻は前後イベントの `occurredAt` を境界（`getTimeBounds`）として検証。

#### イベント追記フローのバリデーション

| フォーム | フィールドと制約 |
|---|---|
| オールイン (`useAllInForm`) | `potSize`(必須,≥0), `trials`(必須,整数,≥1), `equity`(必須,0〜100), `wins`(必須,≥0)。既定 pot=0,trials=1 |
| チップ追加/除去 (`useAddonForm`) | `amount`(必須,整数,≥0、`Math.round`)。既定 0 |
| メモ (`useMemoFormSheet`) | `text`(1文字以上必須)、送信後リセット |
| トーナメント スタック更新 (`useTournamentStackForm`) | `stackAmount`(必須,整数,≥0), `remainingPlayers`(任意,整数,≥1), `totalEntries`(任意,整数,≥1)。`recordTournamentInfo` トグルで人数記録の有無を制御 |
| キャッシュ完了 (`useCashGameCompleteForm`) | `finalStack`(必須,整数,≥0)。既定値に現在スタックを使用 |
| トーナメント完了 (`useTournamentCompleteForm`) | `prizeMoney`(必須,整数,≥0), `bountyPrizes`(任意,整数,≥0), `beforeDeadline`。`beforeDeadline=false` のときのみ `placement`(必須,整数,≥1)・`totalEntries`(必須,整数,≥1)を要求（`superRefine`） |

#### 座席・プレイヤー管理（テーブルシーン）

- 座席数はゲーム定義の `tableSize` から解決（2〜10 の範囲外・未指定は既定 9、`resolveSeatCount`）。
- ヒーロー席は `heroSeatPosition`（負値は null 扱い）。`heroSeatPosition === null` のとき新たにヒーロー席を主張可能。座席にヒーローを置く/外す操作は `updateHeroSeatViaClient` を楽観更新で実行。
- 各座席に対し、既存プレイヤー着席・新規プレイヤー作成着席・一時プレイヤー着席・離席が可能。座席内でメモ/タグのインライン編集（プレイヤー側のフックが担当）。
- **スクリーンショットから着席**: 対応アプリを選択 → 画像（JPEG/PNG/GIF/WEBP のみ）をアップロード → AI 抽出（`aiExtract.extractTablePlayers`）→ レビュー（各行を skip/new/existing に振り分け、名前正規化で既存プレイヤーと突合、重複席番号は無視、ヒーローは1人のみ）→ 一括適用。適用結果を成功/失敗件数でトースト通知。

#### ライブセッションへのマスター割当（assign）

ライブ進行中にリングゲーム／トーナメントのマスターを後から紐付け可能。`existing`（既存選択）/ `create`（新規作成して同時割当）の2モード。新規作成時はマスター（`ringGame.create` / `tournament.createWithLevels`）を作ってから `liveCashGameSession.update` / `liveTournamentSession.update` で割当。ルーム未選択での新規作成はエラートースト。

#### ライブセッションのルールスナップショット編集

`useRingGameSceneActions` / `useTournamentSceneActions` はライブセッションの凍結済みルールスナップショット（`session_cash_detail` / `session_tournament_detail`・`session_blind_level`・`session_chip_purchase`）のみを `updateSnapshot` で更新し、マスターには波及させない。

#### トーナメントタイマー

- `timerStartedAt`（Unix秒、null可）を基準にブラインドレベルを進行（`computeTournamentTimerState`）。ブラインドレベルを `level` 昇順にソートし、経過秒から現在レベル・残り秒・進捗率・次レベル・総所要時間を算出。`minutes` が 0/未設定のレベルは無期限（残り秒 null）。
- タイマー表示は `useNowTick` が `setInterval` で再描画を駆動。時刻表示は `h:mm:ss`（1時間未満は `mm:ss`）。レベルラベルは Break 表示・ブラインド `SB/BB/ストラドル` + ante 併記。

#### ヘッダーメニューと収支サマリー

セッションヘッダーの「…」メニューは、種別固有のイベントアクション（キャッシュ: All-in / Add chips / Remove chips / Memo、トーナメント: Buy chips / Memo）の下にライフサイクル（Pause / End / Game settings / Discard〔破棄は destructive〕）を並べる。キャッシュのコンパクトサマリーは現在スタック・総バイイン・EV差・開始時刻、トーナメントは平均スタック・残り人数・総エントリーを表示。

---

### 統計

完了済みセッションを集計してKPI・テーブル・累積収支グラフ・ブレイクダウンで可視化する。フィルタ状態は URL 検索パラメータに同期（`/statistics` の `validateSearch`）し、リロード/共有URLで復元される。

#### フィルタ軸（URL 同期）

| 軸 | 値 | 既定 |
|---|---|---|
| 期間 (`period`) | `7d`/`30d`/`90d`/`ytd`/`all`/`custom` | `all` |
| カスタム期間 (`from`/`to`) | Unix 秒（URL からは文字列を coerce） | — |
| 種別 (`type`) | `all`/`cash_game`/`tournament` | `all` |
| 通貨 (`currency`) | 通貨ID | — |
| ルーム (`room`) | ルームID | — |
| 正規化 (`norm`) | `off`（通貨額）/ `normalized`（BB/BI） | `normalized` |

- **正規化（normalization）**: `off` は通貨額表示で単一通貨の選択が必須。`normalized` は BB（キャッシュ）と BI（トーナメント）を同時表示する。BB と BI はスケールが異なるため**決して合算しない** — キャッシュとトーナメントが混在するビューでは2単位を並置する。
- **通貨スコープの妥当性** (`isCurrencyScopeValid`): `norm !== "off"` または通貨選択済みのとき有効。無効時は全クエリを `enabled: false` で停止（サーバの BAD_REQUEST ガードと一致）。
- 種別で表示ブロックを切替: `type !== "tournament"` でキャッシュブロック表示、`type !== "cash_game"` でトーナメントブロック表示（`all` は両方）。

#### KPIカード（`stats.summary`）

種別フィルタにより構成が変化する。

| 条件 | カード |
|---|---|
| 共通 | Net P&L（`normalized` 時は型別: BB単独/BI単独/「all」では BB・BI の2枚を別カードで）, Sessions, Play time |
| 種別 = キャッシュ | + EV diff（`normalized` 時 BB）, + Hourly（`normalized` 時 BB/hr） |
| 種別 = トーナメント | + Avg ROI（常時、通貨非依存の各セッションROI%平均）, ROI（単一通貨選択時のみ）, ITM, Avg place |

#### 種別別 統計テーブル

キャッシュブロックは `type: "cash_game"` 固定でクエリ（グローバル種別が `all` でもキャッシュ専用を維持）。`totalSessions === 0` で空表示。

| キャッシュ統計 | トーナメント統計 |
|---|---|
| Sessions, Net P&L, Avg P&L, Win rate, Play time, Hourly（`normalized` 時 BB/hr）, EV diff | Sessions, Net P&L, Avg P&L, Win rate, Play time, Avg ROI, ROI（単一通貨時）, ITM rate, Avg placement, Total prize（単一通貨時、賞金は常に通貨単位） |

bb/100 はハンド数を追跡しないため意図的に省略。ROI 集計・賞金合計は raw 通貨額を合算するため単一通貨ピン時のみ表示。

#### 累積収支グラフ（`stats.profitLossSeries`）

- X軸は `playTime`（プレイ時間累積）と切替可能（`setXAxis`）。
- 単位はグローバル正規化に追従（`normalized`/`currency`）。`normalized` かつ種別 `all` のときデュアル軸（BB キャッシュ vs BI トーナメント）。
- EVキャッシュ線はキャッシュ専用 — `type === "cash_game"` のときのみトグル可能（`evToggleAvailable`）。それ以外では強制 off。
- 生シリーズを純関数 `aggregatePnlPoints` で累積点へ畳み込み。点が0件で空表示。

#### ブレイクダウン（`stats.breakdown`）

グルーピング軸（タブ）: `room` / `stakes` / `dayOfWeek` / `length` / `month`。`stakes` はキャッシュゲーム（種別ピン時）のみ追加 — トーナメント/`all` ではブラインドステークがないため除外。現在タブは常に利用可能な軸へ補正され、`stakes` 選択中に種別をキャッシュから外しても無効なグルーピングを送らない。各行は Net（通貨）/ BB / BI / セッション数 / プレイ時間。`normalized` 時、値を持つグループがないBB/BI列は非表示。

---

### 設定

| 項目 | 操作 | 詳細 |
|---|---|---|
| サインアウト | `authClient.signOut` | 成功後 `/` へ遷移 |
| テーマ | `next-themes` の `setTheme` | `light` / `dark` / `system` の3択 |
| 連携アカウント | リンク / アンリンク | Google・Discord をソーシャル連携。`authClient.linkSocial`（コールバック `/settings`）、`authClient.unlinkAccount`。アンリンク失敗はエラートースト、成功は「Account unlinked」トースト後に再取得 |
| パスワード設定 | Set password シート | `credential` プロバイダ（メール/パスワード）の有無を `hasCredential` で判定し、未設定なら設定可能にする |

連携アカウントはマウント時に `authClient.listAccounts` で取得。`providerId` でリンク済みプロバイダ集合と総数を算出。

---

### アップデートノート

リリースごとの更新内容（`virtual:update-notes` でビルド時に注入される `UPDATE_NOTES` / `LATEST_VERSION`）を表示し、既読をバージョン単位で管理する。

- 各ノートは `version` / `title` / `releasedAt` / `changes[]` を持つ。
- 既読は `updateNoteView.list`（サーバ既読）と、ローカルの楽観的既読集合（`optimisticallyViewed`）を合成した `viewedVersions` で判定。
- アコーディオンでノートを開く（`handleAccordionChange`）と、未読バージョンを楽観的に既読集合へ追加し `updateNoteView.markViewed` を実行。完了時に既読一覧と「最後に閲覧したバージョン」クエリを無効化。

---

### 認証

Better Auth（`authClient`）ベース。メール/パスワードとソーシャル（Google・Discord）に対応。

#### ルート保護（認証ガード）

- ルート `__root` の `beforeLoad` がガード: `/login` は素通り（`session: null` を返す）。それ以外は `authClient.getSession()` を実行し、セッションがなければ `/login` へリダイレクト。取得済みセッションを router context にマージし子ルートへ受け渡す。
- `/`（ルート）は `beforeLoad` でディスパッチのみ: セッションありなら `/statistics`、なしなら `/login` へリダイレクト（公開ランディングなし）。
- `/login` 以外は `AuthenticatedShell` でラップ。

#### サインイン (`useSignIn`)

| 項目 | 内容 |
|---|---|
| フィールド | `email`, `password` |
| バリデーション | `email`: 有効なメール形式（"Invalid email address"）、`password`: 8文字以上（"Password must be at least 8 characters"） |
| 成功時 | `/statistics` へ遷移 + "Sign in successful" トースト |
| 失敗時 | エラーメッセージ（なければ statusText）をトースト |
| ソーシャル | Google / Discord（`signIn.social`、コールバック `/statistics`）。失敗時エラートースト |

#### サインアップ (`useSignUp`)

| 項目 | 内容 |
|---|---|
| フィールド | `name`, `email`, `password` |
| バリデーション | `name`: 2文字以上（"Name must be at least 2 characters"）、`email`: 有効なメール形式、`password`: 8文字以上 |
| 成功時 | `/statistics` へ遷移 + "Sign up successful" トースト |
| ソーシャル | サインインと同じ Google / Discord 連携 |

#### ログインページの画面切替・プレビュー自動ログイン

- `useLoginPage` が `showSignIn` でサインイン/サインアップ表示を切替。
- `usePreviewAutoLogin`: 環境変数 `VITE_PREVIEW_AUTO_LOGIN === "true"` かつ `VITE_PREVIEW_LOGIN_EMAIL`/`_PASSWORD` が揃うときに限り、1回だけ（`attempted` ref でガード）自動ログインを試み、成功時 `/statistics` へ遷移。プレビュー環境専用。

---

参照した主なフック（いずれも絶対パス）:
- セッション: `/home/user/sapphire2/apps/web/src/features/sessions/hooks/use-sessions.ts`, `.../use-session-detail.ts`, `.../components/session-wizard/use-session-form-state.ts`, `.../utils/session-form-helpers.ts`, `.../utils/session-filters-helpers.ts`, `.../utils/share-session.ts`
- ライブ: `/home/user/sapphire2/apps/web/src/features/live-sessions/hooks/use-active-session.ts`, `.../use-create-session.ts`, `.../use-cash-game-stack.ts`, `.../use-tournament-stack.ts`, `.../use-session-events.ts`, `.../utils/optimistic-session-event.ts`, `.../utils/session-events-formatters.ts`, `.../utils/tournament-timer.ts`, `.../pages/active-session-page/{cash-game-session,tournament-session}/use-*-view.ts`, `.../components/active-session-scene/use-active-session-scene-state.ts`
- 統計: `/home/user/sapphire2/apps/web/src/features/statistics/utils/stats-filters.ts`, `.../hooks/use-stats-filters.ts`, `.../pages/statistics-page/{kpi-cards,cash-game-stats,tournament-stats,breakdown-section,pnl-graph}/use-*.ts`
- 設定: `/home/user/sapphire2/apps/web/src/features/settings/pages/settings-page/{use-settings-page.ts,linked-accounts/use-linked-accounts.ts,theme-setting/use-theme-setting.ts}`
- アップデートノート: `/home/user/sapphire2/apps/web/src/features/update-notes/hooks/use-update-notes-viewed.ts`, `.../constants.ts`
- 認証/ルート: `/home/user/sapphire2/apps/web/src/features/auth/pages/login-page/**`, `/home/user/sapphire2/apps/web/src/routes/{__root,index,statistics,active-session}.tsx`

## 12. 環境・デプロイ・リリースフロー

### 環境変数

#### サーバ環境変数（Cloudflare Worker `sapphire2-api`）

`apps/server/src/worker.ts` の `Env` インタフェースが受け取る変数。`.dev.vars.example` がローカル用テンプレート。本番/プレビュー/dev では `wrangler deploy --var ...`（平文）と `wrangler secret put`（暗号化シークレット）で注入される。

| 変数名 | 必須 | 注入方法 | 用途 |
|---|---|---|---|
| `DB` | 必須 | wrangler.toml の D1 binding | Cloudflare D1 データベースバインディング（`createDb(c.env.DB)`） |
| `BETTER_AUTH_SECRET` | 必須 | secret | Better Auth の署名シークレット。`openssl rand -base64 32` 等で32文字以上 |
| `BETTER_AUTH_URL` | 必須 | var（`--var BETTER_AUTH_URL`） | Better Auth の `baseURL`。コールバックURL生成の基点 |
| `CORS_ORIGIN` | 必須 | var（`--var CORS_ORIGIN`） | CORS の許可オリジン。同時に Better Auth の `trustedOrigins` にも設定される |
| `NODE_ENV` | 必須 | wrangler.toml `[vars]` / `--var`（`production`） | Node 実行モード |
| `ANTHROPIC_API_KEY` | 任意 | secret | tRPC コンテキストへ渡され、Anthropic API 連携機能で利用（`createContextFactory(auth, db, c.env.ANTHROPIC_API_KEY)`） |
| `GOOGLE_CLIENT_ID` | 任意 | secret | Google OAuth。ID/Secret 両方が揃った時のみ `socialProviders.google` を有効化 |
| `GOOGLE_CLIENT_SECRET` | 任意 | secret | 同上 |
| `DISCORD_CLIENT_ID` | 任意 | secret | Discord OAuth。ID/Secret 両方が揃った時のみ `socialProviders.discord` を有効化 |
| `DISCORD_CLIENT_SECRET` | 任意 | secret | 同上 |

OAuth プロバイダは「Client ID と Secret の両方が存在する時のみ」`createAuth` で条件付きに登録される（片方欠落時はそのプロバイダが無効）。認証 Cookie は `sameSite: "none"` / `secure: true` / `httpOnly: true` で発行されるため、フロントとAPIが別オリジン（Pages ↔ Workers）でもクロスサイトで動作する。

#### クライアント環境変数（Vite, `VITE_` プレフィックス）

`packages/env/src/web.ts` の `webEnvSchema` で Zod 検証される。`createEnv`（`@t3-oss/env-core`）が `clientPrefix: "VITE_"` で囲い込み、宣言済みキーのみ公開する（プレフィックスを持たない変数はランタイムに混入しても露出しない）。`emptyStringAsUndefined: true` のため空文字は `undefined` 扱い。`env` はビルド時ではなく初回アクセス時に検証する遅延 Proxy。

| 変数名 | 型/検証 | 必須 | 用途 |
|---|---|---|---|
| `VITE_SERVER_URL` | `z.url()`（http/https いずれも可、スキーム必須） | 必須 | API サーバの URL。tRPC クライアントと auth クライアントの接続先。欠落・空文字・非URL・スキーム無し・数値は検証エラーで throw |
| `VITE_PREVIEW_AUTO_LOGIN` | `z.string().optional()` | 任意 | `"true"` の時のみプレビュー自動ログインを発火 |
| `VITE_PREVIEW_LOGIN_EMAIL` | `z.string().optional()` | 任意 | 自動ログイン用テストアカウントのメール |
| `VITE_PREVIEW_LOGIN_PASSWORD` | `z.string().optional()` | 任意 | 自動ログイン用テストアカウントのパスワード |

プレビュー自動ログイン（`use-preview-auto-login.ts`）は、`VITE_PREVIEW_AUTO_LOGIN === "true"` かつ email と password が揃った場合に限り `authClient.signIn.email` を一度だけ（`useRef` ガードで二重発火防止）実行し、成功すると `/statistics` へ遷移する。プレビュー環境（`preview-deploy.yml`）でのみこれら3変数がビルド時に設定される。

#### CI/CD で使われる GitHub Secrets / Variables

| 名前 | 種別 | 用途 |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Variable | Cloudflare アカウント ID。全デプロイ系ワークフローで使用 |
| `CLOUDFLARE_API_TOKEN` | Secret | Workers/Pages/D1 編集権限付きトークン |
| `BETTER_AUTH_SECRET` | Secret | Worker secret に投入 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Secret | Worker secret に投入 |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Secret | Worker secret に投入 |
| `ANTHROPIC_API_KEY` | Secret | Worker secret に投入 |
| `PREVIEW_LOGIN_EMAIL` / `PREVIEW_LOGIN_PASSWORD` | Secret | プレビュービルドの `VITE_PREVIEW_LOGIN_*` へ |
| `PRODUCTION_API_URL` | Secret | 本番 Worker URL。`BETTER_AUTH_URL` / `VITE_SERVER_URL` に使用 |
| `PRODUCTION_WEB_URL` | Secret | 本番 Pages URL。`CORS_ORIGIN` に使用 |
| `CLAUDE_CODE_OAUTH_TOKEN` | Secret | Claude Code Action（レビュー・リリースノート生成） |

### Cloudflare バインディングと Workers / Pages 構成

`apps/server/wrangler.toml`:

| 項目 | 値 |
|---|---|
| Worker 名 | `sapphire2-api`（本番）。dev は `sapphire2-api-dev`、プレビューは `sapphire2-api-pr-<番号>` に上書き |
| エントリポイント | `src/worker.ts` |
| `compatibility_date` | `2025-01-01` |
| `compatibility_flags` | `["nodejs_compat"]` |
| `[vars]` | `NODE_ENV = "production"`（デプロイ時 `--var` で `BETTER_AUTH_URL` / `CORS_ORIGIN` / `NODE_ENV` を追加・上書き） |
| D1 binding | `binding = "DB"`, `database_name = "sapphire2-db"`, `database_id = 6f229350-...`, `migrations_dir = "../../packages/db/src/migrations"` |

構成は3層: Cloudflare CDN 配下に **Pages（React SPA, プロジェクト名 `sapphire2-web`）** と **Workers（Hono API）** が並び、Worker が **D1（SQLite）** へアクセスする。

Hono アプリ（`worker.ts`）のルート構成（マウント位置順）:

| パス / メソッド | ハンドラ | 内容 |
|---|---|---|
| `/*`（全リクエスト） | CORS ミドルウェア | `origin: c.env.CORS_ORIGIN`、許可メソッド `GET/POST/OPTIONS`、許可ヘッダ `Content-Type`/`Authorization`、`credentials: true` |
| `POST /api/auth/set-password` | Better Auth `setPassword` | パスワード設定専用エンドポイント |
| `POST`/`GET` `/api/auth/*` | Better Auth `handler` | サインイン/サインアップ/OAuth コールバック等。OAuth コールバックは `/api/auth/callback/{google,discord}` |
| `/trpc/*` | `@hono/trpc-server` ミドルウェア | `appRouter` をマウント。`createContextFactory(auth, db, ANTHROPIC_API_KEY)` でコンテキスト生成 |
| `GET /` | `c.text("OK")` | ヘルスチェック相当 |

各ハンドラはリクエストごとに `createDb(c.env.DB)` と `createAuth(db, {...})` を生成する（Workers のリクエストスコープモデルに沿った構成）。

### 環境（preview / dev / production）の生成方法とトリガ

| 環境 | トリガ | Worker 名 | Pages ブランチ | D1 データベース | API/Web の URL 解決 |
|---|---|---|---|---|---|
| ローカル | `bun run dev` | `wrangler dev`（ローカルシミュレーション, :8787） | Vite :3001 | ローカル D1 | `.dev.vars` に手動設定 |
| preview | PR の `opened`/`synchronize`/`reopened` | `sapphire2-api-pr-<番号>` | `pr-<番号>`（`sapphire2-web` 配下） | `sapphire2-db-pr-<番号>`（PR ごとに独立） | Cloudflare API から subdomain を取得し動的生成 |
| dev | `dev` への push（または `workflow_dispatch`） | `sapphire2-api-dev` | `dev`（`sapphire2-web` 配下） | `sapphire2-db-dev`（毎デプロイ削除→再作成） | 同上、動的生成 |
| production | GitHub Release `published` | `sapphire2-api` | `main`（`sapphire2-web` 配下） | `sapphire2-db`（マスタDB） | `PRODUCTION_API_URL` / `PRODUCTION_WEB_URL` シークレット |

**D1 のシード戦略（preview / dev 共通の「stash → base-migrate → seed → restore → migrate-rest」フロー）**: 新規プレビュー DB はマスタ DB（`sapphire2-db`）からデータをコピーして作る。ただしマスタの適用済みマイグレーションは HEAD より古い場合がある。そこで (1) マスタの `d1_migrations` テーブルで最新タグを照会し、(2) それより新しいマイグレーションファイルを一時退避（`_journal.json` も書き換え）、(3) マスタが持つマイグレーションだけを適用してスキーマを一致させ、(4) `wrangler d1 export --no-schema` でデータをシード（`PRAGMA foreign_keys = OFF/ON` で囲む、`d1_migrations` の INSERT は除去）、(5) 退避したマイグレーションを戻して適用しバックフィルを走らせる。preview は新規 DB（`is_new_db == 'true'`）の時だけこの seed を行い、2回目以降はデータを持ち越してマイグレーション差分のみ適用する。dev DB は毎回 drop→recreate するため常にフルフローを実行する。

デプロイ時の URL は、`setup` ジョブが Cloudflare API（`/workers/subdomain` と `/pages/projects/<project>`）から workers subdomain と pages domain を取得し、`https://<worker>.<subdomain>.workers.dev` / `https://<branch>.<pages-domain>` の形で動的に組み立てる。これを `BETTER_AUTH_URL` / `CORS_ORIGIN`（Worker）と `VITE_SERVER_URL`（Web ビルド）へ渡す。

### CI/CD ワークフロー一覧

`.github/workflows/` の各ファイルの役割とトリガ。

| ワークフロー | ファイル | トリガ | 役割 |
|---|---|---|---|
| CI | `ci.yml` | PR → `dev` / `main` | `bun install --frozen-lockfile` → `check-types` → `check`（lint）→ `test:ci`。`main` の必須ステータスチェック `ci` の実体 |
| PR review | `pre-merge-review.yml` | PR（`opened`/`synchronize`/`reopened`/`ready_for_review`）→ `dev` / `main`、draft 除外 | `anthropics/claude-code-action` が `/review` を実行。`track_progress: true` で単一の追跡コメントを自動投稿・更新。inline コメント + 重大度別サマリ。`--model opus --max-turns 40` |
| Claude Code | `claude.yml` | issue/PR コメント・レビュー・issue で `@claude` メンション | `@claude` 宛の汎用エージェント実行 |
| Preview Deploy | `preview-deploy.yml` | PR `opened`/`synchronize`/`reopened` | D1 解決/作成 → マイグレーション+シード → Worker デプロイ（secret 投入）→ Web ビルド（自動ログイン有効）→ Pages デプロイ（`pr-<番号>`）→ PR にプレビュー URL 表を投稿（`Preview Environment` コメントを find/replace） |
| Preview Cleanup | `preview-cleanup.yml` | PR `closed` | 当該 PR の Worker 削除、孤児プレビュー Worker（open PR と照合し残す）削除、Pages デプロイ削除、D1 削除、PR コメントを「cleaned up」に更新。各ステップ `continue-on-error: true` |
| Dev Deploy | `dev-deploy.yml` | `dev` への push / `workflow_dispatch` | CI → dev D1 を drop→recreate → フルシード/マイグレーション → Worker（`sapphire2-api-dev`）デプロイ → Web ビルド → Pages（`dev`）デプロイ。`concurrency: dev-deploy`（`cancel-in-progress: false`）で直列化 |
| PR target guard | `pr-target-guard.yml` | PR（`opened`/`reopened`/`edited`/`synchronize`）→ `main` | head ブランチが `^release/v[0-9]+\.[0-9]+\.[0-9]+$` に一致しなければ失敗。`main` の必須チェック `pr-target-guard` の実体 |
| Production Deploy | `production-deploy.yml` | GitHub Release `published` | CI → `db:migrate:remote`（マスタ D1 にマイグレーション）→ Worker（`sapphire2-api`）デプロイ+secret 投入 → Web ビルド（`PRODUCTION_API_URL`）→ Pages（`main`）デプロイ。`concurrency: production-deploy`（`cancel-in-progress: false`）で直列化、CI 失敗時はデプロイをスキップ |
| Release on Merge | `release.yml` | PR `closed` → `main`、かつ merged かつ head が `release/v*` | ブランチ名からバージョン抽出 → Claude Code Action が `/create-update-notes` を headless 実行しリリースノートを構造化出力（`--json-schema` の `release_notes`）→ `gh release create <version> --target main` で Release 公開 → PR にリリース URL をコメント。Release 公開が `production-deploy.yml` を連鎖発火 |
| Project Sync | `project-sync.yml` | issue `labeled`（`wf:` 始まり） | `wf:*` ラベルを GitHub Project の Status 列へマッピングして同期（`PROJECT_NUMBER` 未設定時は warning でスキップ） |

補足: デプロイ系ワークフローは全て `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` を設定し、Bun は `oven-sh/setup-bun@v2`（`bun-version: latest`）でセットアップする。

### ブランチ戦略・リリースフロー

フロー: **`feature → dev → release/vX.Y.Z → main`**。

- `dev` が PR の既定ベース。`feature` ブランチは `dev` へ PR する。
- `dev` への push は `dev-deploy.yml` で常設 dev 環境へ自動反映。
- リリースは `dev` から `release/vX.Y.Z` ブランチを切り、`main` へ PR する（`git checkout -b release/vX.Y.Z dev && git push -u origin HEAD` → `gh pr create --base main`）。
- **`main` への保護**: `main` は `release/vX.Y.Z` パターンの head ブランチからの PR のみ受け付ける。二重に強制される:
  - ワークフロー `pr-target-guard.yml`（head が `^release/v[0-9]+\.[0-9]+\.[0-9]+$` でなければ失敗）。
  - GitHub Ruleset `main-release-only.json`（`refs/heads/main` 対象、`enforcement: active`）: 削除禁止、non-fast-forward 禁止、PR 必須（必須承認数 0）、必須ステータスチェック `pr-target-guard` と `ci`。`strict_required_status_checks_policy: false`。
- **マージ時の自動リリース**: release PR が `main` にマージされると `release.yml` が発火し、(1) ブランチ名からバージョン（`vX.Y.Z`）を抽出、(2) `/create-update-notes` スキルで過去リリースのスタイルに沿ったリリースノートを CI 上で自動生成（headless・構造化出力経由。インタラクティブ確認やファイル出力はスキップ）、(3) `gh release create` でタグ作成と GitHub Release 公開を行う。
- Release 公開が `production-deploy.yml` を連鎖発火し、本番へデプロイされる。
- **手動リリースノート**: ローカルで `/create-update-notes vX.Y.Z` を実行可能。CI 外で使うと draft 専用（公開しない）。

### PWA としての機能

`apps/web/vite.config.ts` の `vite-plugin-pwa`（`VitePWA`）と `pwa-assets.config.ts` による。見た目ではなく機能面の挙動:

| 項目 | 設定 / 挙動 |
|---|---|
| Service Worker 登録 | `registerType: "autoUpdate"` — 新バージョン検出時に Service Worker を自動更新（ユーザー操作なしで最新を適用） |
| オフライン対応 | Service Worker による precache（Workbox ベース）でアプリシェルをキャッシュし、オフライン/再接続時もロード可能 |
| インストール（manifest） | `name`/`short_name` = `sapphire2`、`description` = `sapphire2 - PWA Application`、`theme_color` = `#0c0c0c`、`start_url` = `/dashboard`（ホーム画面起動時の初期ルート） |
| PWA アセット生成 | `pwaAssets: { disabled: false, config: true }` + `pwa-assets.config.ts`（`@vite-pwa/assets-generator`、`minimal2023Preset`、`headLinkOptions.preset: "2023"`）。アイコンは `public/logo.png` から生成 |
| 開発時の SW | `devOptions: { enabled: true }` — 開発サーバでも Service Worker を有効化 |

加えて `vite-plugin-github-releases`（`githubReleasesPlugin("hiro15254/sapphire2")`）がビルド時に GitHub Releases API（`/releases?per_page=50`、draft 除外）を取得し、仮想モジュール `virtual:update-notes` として `UPDATE_NOTES`（version / releasedAt（日付のみ）/ title / changes（本文の箇条書きを抽出、見出し行は除外））と `LATEST_VERSION` をビルドに埋め込む。これがアプリ内の更新ノート表示の元データとなり、リリースフロー（`release.yml` が公開する GitHub Release）とフロントの更新通知が連動する。

---

参照ファイル（すべて絶対パス）:
- `/home/user/sapphire2/packages/env/src/web.ts`, `/home/user/sapphire2/packages/env/src/__tests__/web.test.ts`
- `/home/user/sapphire2/apps/server/wrangler.toml`, `/home/user/sapphire2/apps/server/src/worker.ts`, `/home/user/sapphire2/apps/server/.dev.vars.example`
- `/home/user/sapphire2/packages/auth/src/index.ts`
- `/home/user/sapphire2/apps/web/vite.config.ts`, `/home/user/sapphire2/apps/web/pwa-assets.config.ts`, `/home/user/sapphire2/apps/web/src/plugins/vite-plugin-github-releases.ts`, `/home/user/sapphire2/apps/web/src/features/auth/pages/login-page/preview-auto-login/use-preview-auto-login.ts`
- `/home/user/sapphire2/.github/workflows/{ci,claude,dev-deploy,pr-target-guard,pre-merge-review,preview-deploy,preview-cleanup,production-deploy,project-sync,release}.yml`
- `/home/user/sapphire2/.github/rulesets/main-release-only.json`
- `/home/user/sapphire2/docs/deploy.ja.md`, `/home/user/sapphire2/package.json`

## 付録A. 整合性・補足メモ

各セクション間で**重大な不整合は検出されず**、ドメインの中核概念（イベントソーシング、スナップショット凍結、所有権の二段検証、通貨残高＝取引合計）は全セクションで一貫して記述されている。以下は読者向けの補足と、軽微な表記揺れ・記述の重複に関する注意点である。

- **同一概念の別名に注意**: DB スキーマ層は物理名（`game_session`, `currency_transaction` 等）、API/フロント層は tRPC ルーター名・キャメルケース（`gameSession`, `currencyTransaction`, `ringGame` 等）で同一エンティティを指す。本仕様書では文脈に応じて両表記が混在する。

- **「session」の二義性**: 認証セッション（`session` テーブル / ログインセッション）とゲームセッション（`game_session`）は別物。data-model セクションが明示しているとおり、単に「セッション」と書かれた場合は文脈（認証 vs プレイ記録）で判別すること。

- **CHECK 制約と source の対応**: `session_manual_completed_check`（`source != 'manual' OR status = 'completed'`）により、手動入力セッションは常に `completed`、`active`/`paused` を取り得るのは `source = 'live'` のみ。features-b の「楽観的に `status: completed` の手動アイテムを挿入」という記述はこの制約と整合する。

- **`validateEntityOwnership` の所有権チェックの粒度**: api-tournament-session セクションが注記するとおり、`session.ts` の `validateEntityOwnership` では `ringGame` / `tournament` は存在チェックのみで `userId` 照合を行わない（親 Room のチェックは別経路）。所有権はリングゲーム＝Room 経由、トーナメント＝Room 経由で担保される設計であり、矛盾ではないが、レビュー時はこの非対称性を意識する必要がある。

- **チップ購入の「定義」と「結果」の分離**: `tournament_chip_purchase`（テンプレート側の購入メニュー定義）と、セッション側の `session_chip_purchase` / `session_chip_purchase_result`（count を保持）は別テーブル。api-tournament-session・api-live-stats-ai・domain-logic の各セクションがこの分離を一貫して述べている。

- **正規化単位の非合算ルール**: BB（キャッシュ）と BI（トーナメント）はスケールが異なるため**決して合算しない**。統計・グラフ・ブレイクダウンの各所（features-b / domain-logic）で同じ方針が繰り返されており、混在ビューでは2単位を並置する。これは重複ではなく意図的な再強調と解釈してよい。

- **`start_url` とルート定義の不一致（実装上の潜在課題）**: PWA manifest（`apps/web/vite.config.ts`）の `start_url` は `"/dashboard"` だが、TanStack Router のルートツリー（`apps/web/src/routes/`）に `/dashboard` ルートは存在しない。ルート `/`（`routes/index.tsx`）は認証済みなら `/statistics`、未認証なら `/login` へリダイレクトし、アプリ内ナビゲーションの基準も `/statistics` である。したがって PWA をインストール経路から起動すると未定義ルートに着地する可能性があり、`start_url` を `/` もしくは `/statistics` へ修正する余地がある（本仕様書はコードの現状を記述しており、これは将来の修正候補として記録する）。

- **AI 抽出機能の任意性**: Anthropic 連携（トーナメント情報抽出・着席プレイヤー抽出）は `ANTHROPIC_API_KEY` が設定された場合のみ有効な任意機能であり、認証・記録・統計のコア機能は API キーなしで完全に動作する。auth / infra / features 各セクションの記述は一致している。
