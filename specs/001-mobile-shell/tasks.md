# Tasks: レスポンシブ App Shell

**Input**: `specs/001-mobile-shell/`
**Status**: Complete / synced to current implementation

## Completed Checks

- [x] `app-navigation.tsx` の共有ナビ定義と active state 判定を確認
- [x] `mobile-nav.tsx` の 5 スロット構成と中央アクション切替を確認
- [x] `sidebar-nav.tsx` の固定サイドバーとフッター controls を確認
- [x] `authenticated-shell.tsx` の `OnlineStatusBar`、余白調整、`LiveStackFormSheet` を確認
- [x] `__root.tsx` で `/login` が shell 外になっていることを確認
- [x] `DevtoolsToggle` が shell 外側で独立表示されることを確認

## Verification Notes

- モバイルでは `md:hidden` のボトムナビのみ表示される
- デスクトップでは `hidden md:flex` のサイドナビのみ表示される
- pathname の変更に応じて active state が更新される
- active session の有無でモバイル中央アクションとルート項目が切り替わる

## Remaining Work

- なし
