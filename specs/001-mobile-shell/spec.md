# Feature Specification: レスポンシブ App Shell

**Feature Branch**: `001-mobile-shell`
**Created**: 2026-03-12
**Status**: Implemented (synced to current codebase)

## Summary

`AuthenticatedShell` が認証済み画面の共通レイアウトを担う。モバイルでは固定ボトムナビゲーション、デスクトップでは固定サイドナビゲーションを表示し、`/login` ではこの shell を使わない。ナビゲーション定義は `apps/web/src/components/app-navigation.tsx` に集約され、pathname に応じて active state を切り替える。

## User Scenarios & Testing

### User Story 1 - モバイルで固定ボトムナビゲーションが表示される (Priority: P1)

モバイル端末のユーザーは、画面下部に固定された 5 スロットのナビゲーションバーを使って主要画面に移動できる。中央スロットは通常時は `New`、アクティブセッション中は `Stack` のアクションになり、左右の 4 スロットはルート遷移を担う。アクティブセッション中はルート項目も `Events` / `Players` / `Overview` / `Settings` に切り替わる。

**Independent Test**: モバイル幅でアプリを開き、ボトムナビゲーションが常時表示されること、5 スロットが均等幅で並ぶこと、中央アクションが状態に応じて切り替わることを確認する。

**Acceptance Scenarios**:

1. **Given** モバイル幅で認証済み画面を開いたとき、**Then** 画面下部に固定された 5 スロットのボトムナビゲーションが表示される
2. **Given** アクティブセッションがないとき、**Then** 中央アクションは `New` と表示され、セッション作成ダイアログを開く
3. **Given** アクティブセッションがあるとき、**Then** 中央アクションは `Stack` と表示され、ライブ用スタック入力シートを開く
4. **Given** アクティブセッションがないとき、**Then** ルート項目は `Sessions` / `Stores` / `Players` / `Settings` に表示される
5. **Given** アクティブセッションがあるとき、**Then** ルート項目は `Events` / `Players` / `Overview` / `Settings` に表示される

---

### User Story 2 - デスクトップで固定サイドナビゲーションが表示される (Priority: P2)

デスクトップのユーザーは、画面左側に固定されたサイドナビゲーションから `Sessions`、`Stores`、`Players`、`Settings` に移動できる。サイドバー下部には `UserMenu` と `ModeToggle` が並ぶ。

**Independent Test**: デスクトップ幅でアプリを開き、左側に固定サイドバーが表示され、モバイル用ボトムナビが表示されないことを確認する。

**Acceptance Scenarios**:

1. **Given** デスクトップ幅で認証済み画面を開いたとき、**Then** 左側に固定サイドナビゲーションが表示される
2. **Given** サイドナビをクリックしたとき、**Then** 対応するルートへ遷移し、active state が更新される
3. **Given** サイドバー下部を表示したとき、**Then** `UserMenu` と `ModeToggle` が表示される

---

### User Story 3 - 認証済み shell と public/login の分離 (Priority: P3)

認証済みページでは共通 shell が表示され、`/login` では表示されない。`OnlineStatusBar` は shell 内の上部に出て、コンテンツは固定ナビゲーションと重ならないように余白が確保される。

**Independent Test**: `/login` と認証済みページを開き、shell の有無が切り替わること、かつコンテンツがモバイル下部・デスクトップ左側の固定ナビゲーションと重ならないことを確認する。

**Acceptance Scenarios**:

1. **Given** `/login` を開いたとき、**Then** `AuthenticatedShell` は表示されない
2. **Given** 認証済みページを開いたとき、**Then** `OnlineStatusBar` と固定ナビゲーションを含む共通 shell が表示される
3. **Given** モバイルまたはデスクトップでコンテンツをスクロールしたとき、**Then** 固定ナビゲーションは表示位置を保つ

---

### User Story 4 - active session と devtools が干渉しない (Priority: P4)

開発者は、`DevtoolsToggle` を使いながらモバイルボトムナビまたはデスクトップサイドナビを操作できる。アクティブセッション中もナビゲーションの状態は pathname と同期している。

**Independent Test**: 開発環境で devtools とナビゲーションを同時表示し、重なりや操作不能が起きないことを確認する。

**Acceptance Scenarios**:

1. **Given** 開発環境でアプリを開いたとき、**Then** `DevtoolsToggle` が shell の外側で操作可能である
2. **Given** ブラウザの戻る/進む操作を行ったとき、**Then** ナビゲーションの active state が pathname に追従する

## Requirements

### Functional Requirements

- **FR-001**: 認証済みルートは共通 shell を使い、`/login` は shell を使ってはならない
- **FR-002**: モバイル幅では画面下部に固定されたボトムナビゲーションを表示しなければならない
- **FR-003**: ボトムナビゲーションは 5 スロットで、各スロットは均等幅でなければならない
- **FR-004**: 中央スロットは通常時 `New`、アクティブセッション中は `Stack` のアクションに切り替わらなければならない
- **FR-005**: ボトムナビのルート項目は active session の有無に応じて `Sessions` / `Stores` / `Players` / `Settings` と `Events` / `Players` / `Overview` / `Settings` を切り替えなければならない
- **FR-006**: ボトムナビのルート項目は pathname と active state を同期しなければならない
- **FR-007**: デスクトップ幅では画面左側に固定されたサイドナビゲーションを表示しなければならない
- **FR-008**: サイドナビゲーションには `Sessions`、`Stores`、`Players`、`Settings` を表示しなければならない
- **FR-009**: サイドナビゲーション下部には `UserMenu` と `ModeToggle` を表示しなければならない
- **FR-010**: `OnlineStatusBar` は shell の上部に表示されなければならない
- **FR-011**: 固定ナビゲーションはコンテンツと重ならないよう、モバイルでは下部余白、デスクトップでは左余白を確保しなければならない
- **FR-012**: ナビゲーションの色・境界・アクティブ表示はテーマトークンに追従しなければならない
- **FR-013**: 開発環境では `DevtoolsToggle` と固定ナビゲーションが干渉してはならない

### Key Entities

- **NavigationItem**: ルート遷移を表す項目。`label`、`to`、`icon`、`exact` を持つ
- **NavigationCenterAction**: モバイル中央スロットのアクション。`New` または `Stack` を表す
- **AuthenticatedShell**: 認証済み画面の共通レイアウト。サイドナビ、モバイルナビ、オンライン状態、ライブシートを束ねる

## Success Criteria

- **SC-001**: モバイル幅では 5 スロットの固定ボトムナビが常に表示される
- **SC-002**: デスクトップ幅では固定サイドナビが表示され、モバイル用ボトムナビは表示されない
- **SC-003**: 中央スロットが `New` と `Stack` の間で active session に応じて切り替わる
- **SC-004**: モバイルのルート項目が active session に応じて `Sessions` / `Stores` / `Players` / `Settings` と `Events` / `Players` / `Overview` / `Settings` を切り替える
- **SC-005**: 戻る/進む操作でも active state が pathname と一致する
- **SC-006**: `/login` では共通 shell が表示されない
- **SC-007**: 開発環境で devtools と固定ナビゲーションが重ならず、両方操作できる

## Assumptions

- レスポンシブ切替は Tailwind の `md` ブレークポイントに従う
- デスクトップのグローバルナビゲーションは現在の主要導線に限定され、他の画面は各ページ内リンクから到達する
- `New` と `Stack` はルートではなくアクションであり、状態に応じて表示が変わる
