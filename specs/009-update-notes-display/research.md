# Research: アップデートノート表示

**Feature**: 009-update-notes-display  
**Date**: 2026-04-11

## Research Tasks

### R1: アップデートノートの静的データ管理方法

**Decision**: アップデートノートのデータをフロントエンド側のTypeScript定数配列として定義する

**Rationale**:
- 仕様書のAssumptionsに「コードベース内に静的に定義」と明記されている
- 管理画面やCMS不要でリリースプロセスがシンプル
- リリースごとにコード内でメンテナンスすることで、コードレビューの対象となり品質が保証される
- フロントエンドに直接定義することで、オフラインでもデータにアクセス可能（offline-first対応）

**Alternatives considered**:
- DBテーブルに保存 → 管理画面が必要になり過剰、静的データに動的管理は不要
- マークダウンファイルとして管理 → ビルド時にパース処理が必要でオーバーヘッド
- 外部CMS連携 → 過剰な複雑さ、このアプリの規模には不適合

### R2: ユーザーの確認状態の永続化方法

**Decision**: D1データベースに `update_note_view` テーブルを追加し、userId + version をキーとして確認状態を記録する

**Rationale**:
- 仕様書のAssumptionsに「サーバー側で永続化」と明記されている
- 異なるデバイスからのアクセスでも一貫した状態を保つ必要がある
- 既存のDrizzle ORM + D1パターンに沿った実装が可能
- ユーザーごとのデータ分離が既存パターン（userId + cascade delete）で容易

**Alternatives considered**:
- localStorage → デバイス間同期不可、仕様要件を満たさない
- IndexedDB（既存TanStack Queryキャッシュ）→ デバイス間同期不可
- cookieに最終確認バージョンを保存 → デバイス間同期不可、データ量制限

### R3: 自動表示のトリガーメカニズム

**Decision**: フロントエンドのAuthenticatedShellレベルで、TanStack Queryを使用してユーザーの最終確認バージョンを取得し、アプリの最新バージョンと比較する

**Rationale**:
- 既存パターン（AuthenticatedShell内でProviderをネスト）に一致
- TanStack Queryのoffline-first設定により、キャッシュがあればオフラインでも動作
- ユーザー認証後にのみ実行されるため、未認証ユーザーへの影響がない
- 既存のStackSheetProviderと同様のContext + ResponsiveDialogパターンで実装可能

**Alternatives considered**:
- Service Workerで検知 → PWA固有で複雑、既存パターンと一致しない
- ルートのbeforeLoadフック → 認証チェックと競合する可能性、UIレンダリング前に実行される
- localStorage比較のみ → サーバー側の状態と同期できない

### R4: アップデートノートのUI配置（手動トリガー）

**Decision**: UserMenuドロップダウンに「Update Notes」アイテムを追加する

**Rationale**:
- UserMenuは全画面で常時アクセス可能（SidebarNav内に配置）
- 既存のDropdownMenu UIパターンに沿った追加で変更が最小限
- 設定ページへの遷移不要で2クリックでアクセス可能（SC-002: 3タップ/クリック以内を満たす）
- ナビゲーション項目を増やさないためモバイルUIへの影響がない

**Alternatives considered**:
- 設定ページにセクション追加 → 3クリック必要（ナビ→設定→ボタン）、SC-002を満たさない可能性
- サイドバーにナビ項目追加 → モバイルの5列ナビが崩れる、過剰な露出
- フッターにリンク追加 → 発見性が低い

### R5: 未確認アップデートの強調表示方法

**Decision**: アコーディオンアイテムの横にBadgeコンポーネントで「NEW」と表示し、未確認アイテムの背景色を変更する

**Rationale**:
- shadcn/ui Badgeコンポーネントが既存で利用可能
- 視覚的に明確な区別ができ、SC-003を満たす
- アコーディオン展開時に確認済みに変更するロジックと自然に組み合わせられる
- Tailwind v4のスタイリングで容易に実装可能

**Alternatives considered**:
- ドット（丸印）のみ → 視覚的に弱い
- テキスト色の変更のみ → アクセシビリティに配慮が必要
- アニメーション → 過剰な装飾
