# Research: プレイヤーメモ機能

## R-001: リッチテキストエディタの選定

**Decision**: Tiptap v2 (`@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/extension-link`)

**Rationale**:
- React 19対応済み（v2.5+）
- `useEditor` hookと`<EditorContent>`による簡潔な統合
- `editor.getHTML()`でHTML出力がネイティブサポート
- StarterKit一つで太字・斜体・見出し・リスト・リンクの全要件を満たす
- バンドルサイズ約50KB（min+gzip）、モバイルアプリとして許容範囲
- MIT License、Tiptap GmbHによる積極的なメンテナンス

**Alternatives considered**:
- **Lexical (Meta)**: バンドルサイズ最小（~30KB）でモバイル最適化。しかしツールバーを自前で構築する必要があり、統合工数が増える。HTML出力はサポートされるが追加パッケージ(`@lexical/html`)が必要
- **Plate (Slate)**: 過剰な機能量、HTML出力がアドオン扱い、バンドルサイズ大（~85KB）
- **Novel (Tiptap wrapper)**: Tiptapより重い（~100KB）割に、不要な機能（スラッシュコマンド、AI連携）が含まれる

## R-002: メモのデータモデル

**Decision**: Playerテーブルに`memo` TEXTフィールドとして保存（1:1のため別テーブル不要）

**Rationale**:
- 仕様で「1プレイヤーにつき1つのメモ（上書き更新方式）」と定義
- 既存パターン（store.memo, pokerSession.memo, ringGame.memo）と一致
- 別テーブルにする利点がない（1:1関係、メモの履歴管理なし）
- クエリが単純（JOINなしで取得可能）

**Alternatives considered**:
- **PlayerMemoテーブル（別エンティティ）**: 仕様書のKey Entitiesでは別エンティティとして記載されているが、1:1関係で履歴管理もないため、フィールドに統合する方がシンプル。将来的に複数メモや履歴が必要になった場合に分離する

## R-003: タグの色管理

**Decision**: プリセットカラーパレット（8-10色）をconst定数として定義。PlayerTagテーブルに`color` TEXTフィールドとして保存

**Rationale**:
- 仕様で「プリセットカラーパレットから色を選択」と指定
- 既存のsessionTagにはcolor属性がないため、新パターン
- Tailwind CSSのカラークラスに対応する色名（"red", "blue", "green"等）を保存し、フロントエンドでTailwindクラスにマッピング
- HEXコードではなく色名で保存することで、テーマ変更に柔軟に対応可能

**Alternatives considered**:
- **HEXカラーコード**: 柔軟だがカスタムカラーピッカーが必要（スコープ外）
- **数値インデックス**: 色の追加・削除時に不整合リスク

## R-004: HTMLサニタイズ戦略

**Decision**: サーバーサイドでの保存時サニタイズは不要。Tiptapのスキーマベースの出力のみに依存する

**Rationale**:
- Tiptapは定義されたスキーマ（extensions）に基づいてHTMLを生成するため、`<script>`タグやイベントハンドラは出力されない
- ユーザーがHTMLを直接入力するインターフェースはない（WYSIWYGエディタ経由のみ）
- 表示時もTiptapのreadonly modeまたは`editor.getHTML()`経由でレンダリングすることで、XSSリスクを最小化
- もし将来的にAPIから直接HTMLを受け付ける場合は、サーバーサイドでDOMPurify等を導入

## R-005: 既存パターンとの整合性

**Decision**: sessionTag/sessionToSessionTag パターンを踏襲

**Rationale**:
- 既存のM2Mパターン：junction tableに複合主キー + cascade delete
- Player CRUD: store.tsのパターン（list/getById/create/update/delete）
- TagInput: 既存の`tag-input.tsx`コンポーネントを拡張（色表示対応）
- ResponsiveDialog: 既存パターンでフォーム表示
- OptimisticUpdate: TanStack Queryのキャッシュ操作パターン踏襲
