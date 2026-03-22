# Research: 002-store-currency-game

## R1: ID生成戦略

**Decision**: `text` 型のUUID (crypto.randomUUID()) を主キーとして使用
**Rationale**: 既存のauthスキーマがtext型IDを使用しており、一貫性を保つ。D1/SQLiteではauto-incrementのintegerも可能だが、将来的なデータ移行やクライアント側でのID事前生成を考慮しtext型UUIDを採用。
**Alternatives considered**:
- auto-increment integer: シンプルだがauth系テーブルとの一貫性がない
- nanoid: 短縮IDだがcrypto.randomUUID()で十分

## R2: カスケード削除 vs アプリケーション層削除

**Decision**: SQLite外部キー制約 + `onDelete: "cascade"` を使用
**Rationale**: 既存authスキーマがcascade削除を使用しており一貫性がある。D1はSQLite外部キーをサポート。アプリケーション層での手動削除はバグの温床になりやすい。
**Alternatives considered**:
- アプリケーション層トランザクション: 複雑で漏れリスクあり
- ソフトデリート: 今回はアーカイブ機能で代替（ゲーム設定のみ）

## R3: アーカイブの実装方式

**Decision**: `archivedAt` タイムスタンプカラム（nullable）を使用
**Rationale**: null = アクティブ、非null = アーカイブ日時。booleanよりアーカイブ時刻の情報が得られる。クエリは `WHERE archivedAt IS NULL` でフィルタ。
**Alternatives considered**:
- boolean `isArchived`: シンプルだがアーカイブ日時情報を失う
- 別テーブルに移動: 複雑すぎ、参照整合性の問題

## R4: トランザクション残高算出

**Decision**: クエリ時にSUM集計で算出（保存された残高フィールドは持たない）
**Rationale**: 個人利用で1通貨あたりのトランザクション数が少ないため、リアルタイム集計で十分。キャッシュ残高を持つと整合性維持が複雑になる。
**Alternatives considered**:
- 残高カラムをcurrencyテーブルに持つ: トランザクション追加/削除時の同期が複雑
- マテリアライズドビュー: D1/SQLiteでは非対応

## R5: ゲームバリアント・ブラインドラベルマッピング

**Decision**: ゲームバリアントはアプリケーション定数（TypeScript const object）として定義。DBにはenumとしてtext型で保存。ラベルマッピングもTypeScript定数で管理。
**Rationale**: バリアントは初期NLHのみで将来的に追加。マスタテーブル化するほどの頻度ではなく、コード上の定数で十分。型安全性も確保しやすい。
**Alternatives considered**:
- DBテーブルとして管理: 動的追加が必要になるまでは過剰
- Zod enumのみ: DBとの整合性がコード上の定数の方が明確

## R6: トランザクション種別のデフォルト初期データ

**Decision**: ユーザー登録時（アカウント作成時）にデフォルト3種（Purchase, Bonus, Other）を自動作成
**Rationale**: ユーザーが最初にトランザクションを記録する時点で種別が存在している必要がある。アカウント作成は1回きりなので、そのタイミングで初期データを挿入するのが最も確実。
**Alternatives considered**:
- 初回トランザクション記録時にlazy作成: 種別選択UIで空になる問題
- シード/マイグレーション: ユーザーごとのデータなのでDB単位のシードでは対応不可

## R7: フロントエンドのフォームパターン

**Decision**: @tanstack/react-form + Zod validatorを使用（既存パターン踏襲）
**Rationale**: sign-in-form.tsx, sign-up-form.tsxで確立されたパターンがあり、一貫性を保つ。
**Alternatives considered**:
- React Hook Form: 既存プロジェクトで未使用

## R8: UIナビゲーション構成

**Decision**: NAVIGATION_ITEMSに "Stores" を追加（Todosを削除）。店舗詳細はネストルート `/stores/$storeId` でタブUI（Currency / Ring Games / Tournaments）。
**Rationale**: TanStack Routerのファイルベースルーティングに合致。タブUIはshadcn/uiのTabsコンポーネントで実装。
**Alternatives considered**:
- フラットルート（/currencies, /games等）: 店舗との関連性が失われる
