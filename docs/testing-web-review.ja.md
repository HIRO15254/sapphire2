# Webテスト移行の個別レビュー

承認済み計画に従い、機械抽出の一覧に対してtest名・assertion・mock境界を読み、変更対象では対応するproductionコードと代替テストも照合した静的な移行判定を記録する。テスト件数やmockの有無だけでは削除しない。以下の「維持」は独立した回帰を保護するため残す判断であり、未変更のすべてを実ブラウザーで検証したという意味ではない。

対象は開始時点のweb test 222ファイル。live-sessions本体とtournament-lifecycle/single-session-guard/session-events-routes、Vite plugin、共通optimistic helperとcurrency第一波、Players一覧親2ファイルは別担当/第一波で扱う。mobile-nav・authenticated-shell・卓player・保存済みsessionのライブ連携は、ここでは現在の認証/編集制約を維持する判断を記録する。

集計: 維持 183ファイル、削除・統合 11ファイル、整理・強化 23ファイル、削除 5ファイル。新規ファイルは下の追加欄に記載し、開始時点の分母に混ぜない。

## 置換と補強の要点

- Currencies/Roomsのページとページhook計4ファイルを、実page・form・QueryClient・tRPC HTTP・MutationCache・toastを通る14シナリオへ統合した。API本体の認可/DB保存はこのMSW fixtureの責任ではなく、API統合テストが担う。
- 保存/favorite拒否でUI期待値が通ってもVitestが未処理Promise errorで失敗するredを確認。両ページのhandlerに拒否処理を追加し、共通MutationCacheのエラー表示と入力保持/retryを維持した。
- Roomのedit/delete/favorite、RingGameのarchive両cache、TransactionType作成の計5箇所で、setterのspyを監視するrollback検証を、楽観状態→拒否→refetch前の実state復元へ置換した。
- TabsはCSS変数/trigger個数から、実click・keyboard・disabled skip・selected panelの関連付けへ置換。label/error/aria-current/sanitizeと既往のfocus-ring不具合は、装飾整理の名目では削除しない。
- PnL集計には固定seedの入力順序不変・非破壊propertyを追加。日付/金額の既知回帰例は別途残す。
- 取引createは楽観的な行追加をしないが、完了時のrefetchがpending中のedit/deleteを上書きし得た。FormSheetのpending中Cancel、削除確認後の即時closeにより並行操作は到達可能。createとedit/deleteの各完了順、およびcreate拒否の計5シナリオをred確認してから、createも更新グループへ参加させて修正した。

## ファイルごとの判定

パスはすべてrepository rootからの相対表記。削除済みパスは移行元の記録である。

| ファイル | 判定 | 契約・根拠/代替 |
| --- | --- | --- |
| `apps/web/src/__tests__/authenticated-shell.test.tsx` | 維持 | 未認証時の遷移、オンライン認証エラーとオフライン継続の区別、保護ページの表示を維持。 |
| `apps/web/src/__tests__/games-route.test.tsx` | 削除・統合 | createFileRouteとGamesPageを双方mockし、宣言したcomponentとmock要素を再確認するだけの2本を削除。game画面のkey回帰/retryはgames-page.test.tsx、route型は生成route treeと型検査で保持。 |
| `apps/web/src/__tests__/home-route.test.tsx` | 維持 | ログイン状態・オフライン状態ごとの初期遷移先を保護。 |
| `apps/web/src/__tests__/login-route.test.tsx` | 維持 | 実ページhookで初期フォーム・相互切替とOAuth再開を確認。use-login-pageの状態単体を吸収。 |
| `apps/web/src/__tests__/mobile-nav.test.tsx` | 維持 | モバイルの遷移・ライブセッション導線、選択中項目のaria-currentを保護。 |
| `apps/web/src/__tests__/settings-route.test.tsx` | 維持 | 実ルートでサインアウトとキャッシュ破棄の順序を保護。 |
| `apps/web/src/__tests__/statistics-raw-search.test.tsx` | 維持 | 実Routerの生search/default区別とpristine時の既定フィルター適用を保護。 |
| `apps/web/src/__tests__/statistics-route.test.tsx` | 削除・統合 | mockしたpageのidentity/存在だけの2本を削除。検索の実挙動はstatistics-raw-search.test.tsxとstats-filters.test.tsで維持。 |
| `apps/web/src/features/auth/pages/login-page/__tests__/use-login-page.test.ts` | 削除・統合 | useStateの初期値/同一toggle反復7本を削除。実ページhookを通すlogin-route.test.tsxのフォーム相互切替に統合。 |
| `apps/web/src/features/auth/pages/login-page/preview-auto-login/__tests__/use-preview-auto-login.test.ts` | 維持 | preview以外での無効化、重複実行防止、ログイン拒否・再試行の契約。 |
| `apps/web/src/features/auth/pages/login-page/sign-in-form/__tests__/use-sign-in.test.ts` | 維持 | 実formの入力検証、認証失敗表示、OAuth redirect復元を保護。 |
| `apps/web/src/features/auth/pages/login-page/sign-in-form/sign-in-form.test.tsx` | 維持 | 実入力・送信・プロバイダー操作とアクセシブルなフォームを保護。 |
| `apps/web/src/features/auth/pages/login-page/sign-up-form/__tests__/use-sign-up.test.ts` | 維持 | 実formの必須値・password検証と認証エラーfallbackを保護。 |
| `apps/web/src/features/auth/pages/login-page/sign-up-form/sign-up-form.test.tsx` | 維持 | 実フォームから登録・既存アカウント導線を操作する保護。 |
| `apps/web/src/features/auth/utils/__tests__/oauth-redirect.test.ts` | 維持 | 外部・偽装URL拒否、許可パス、MCP OAuthパラメーター保持。安全境界のため維持。 |
| `apps/web/src/features/currencies/components/currency-form/__tests__/use-currency-form.test.ts` | 維持 | trim、ASCII unit、任意値のnull化、description長を実formで検証。一覧統合にはない入力境界。 |
| `apps/web/src/features/currencies/hooks/__tests__/use-transaction-types.test.ts` | 整理・強化 | 楽観的に追加した種別が拒否後、refetch保留中に消えることを実hookで確認。setQueryDataのspyを廃止。 |
| `apps/web/src/features/currencies/pages/currencies-page/__tests__/currencies-page.test.tsx` | 削除・統合 | 全hook/子要素mockのページ確認をcatalog-pages.integration.test.tsxへ統合。実tRPC・フォーム・描画・失敗/retryの接続を保護。 |
| `apps/web/src/features/currencies/pages/currencies-page/__tests__/use-currencies-page.test.ts` | 削除・統合 | 全データhook mockのstate/props確認をcatalog-pages.integration.test.tsxへ統合。保存拒否の未処理Promiseを新テストで検出。 |
| `apps/web/src/features/currencies/pages/currencies-page/currency-list-card/__tests__/currency-list-card-skeleton.test.tsx` | 削除 | 装飾class/node個数だけの確認を削除。対応するlist/detailでloadingをempty/errorと区別する挙動は維持。個々の装飾配置に新たなunitテストは置かない。 |
| `apps/web/src/features/currencies/pages/currencies-page/currency-list-card/__tests__/currency-list-card.test.tsx` | 維持 | 金額・unit・リンク表示とfavorite操作が詳細遷移を起こさない契約。 |
| `apps/web/src/features/currencies/pages/currencies-page/currency-list/__tests__/currency-list.test.tsx` | 整理・強化 | 初期loading・empty・errorとキャッシュ済み一覧の継続表示を保護。固定skeleton個数だけ削除。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/__tests__/currency-detail-page.test.tsx` | 維持 | 取引の編集可能性、フォームID、session遷移、pending中操作、空・失敗表示。子mockはあるが一覧統合では代替されない。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/__tests__/use-currency-detail-page.test.ts` | 維持 | 選択ID、取引/残高の編集・削除・失敗後の状態、関連session導線の分岐を保護。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/currency-balance-hero/__tests__/currency-balance-hero.test.tsx` | 維持 | 正負・ゼロ、補助金額とunitの表示。収支の意味を表す色は装飾だけとは扱わない。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/currency-description/__tests__/currency-description.test.tsx` | 整理・強化 | 実expand/collapseと空descriptionは維持。max-height transition classだけの確認を削除。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/currency-detail-skeleton/__tests__/currency-detail-skeleton.test.tsx` | 整理・強化 | placeholderを支援技術から隠すaria-hidden契約1本を維持し、装飾class/node個数2本を削除。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/__tests__/transaction-form.test.tsx` | 維持 | 必須入力、form IDと外部Saveの連携、自前submitを持たないsheet用フォーム契約。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/__tests__/use-transaction-form.test.ts` | 維持 | 新種別作成後の実IDで保存する順序、sentinel除去、取引入力の変換を保護。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/transaction-form/type-combobox/__tests__/use-type-combobox.test.ts` | 維持 | 検索・新規候補・選択、keyboard操作、未知ID、外部値更新とリセットの組合せ。 |
| `apps/web/src/features/currencies/pages/currency-detail-page/transaction-list/__tests__/transaction-list.test.tsx` | 整理・強化 | 金額符号・UTC grouping・automatic行の編集制約・keyboard/session導線は維持。幅span/chevron等の装飾3本のみ削除。 |
| `apps/web/src/features/currencies/utils/__tests__/balance-format.test.ts` | 維持 | 10kの表記境界、正負・単位分類。単なる数値formatter以外の表示規則。 |
| `apps/web/src/features/currencies/utils/__tests__/transaction-list-helpers.test.ts` | 維持 | 日付グループ化と同一日の順序・session由来の表示変換を保護。 |
| `apps/web/src/features/games/pages/games-page/__tests__/games-page.test.tsx` | 維持 | 重複React keyの既往回帰と取得失敗からのretryを維持。モック要素の存在だけのルートtestとは別契約。 |
| `apps/web/src/features/games/pages/games-page/__tests__/use-games-page.test.ts` | 維持 | group/variant/mixの対象ID選択、CRUD後の状態、失敗時の再取得を保護。 |
| `apps/web/src/features/games/pages/games-page/delete-confirm-dialog/__tests__/delete-confirm-dialog.test.tsx` | 維持 | 削除対象名・破壊操作・cancelとpending時の操作制限を保護。 |
| `apps/web/src/features/games/pages/games-page/group-card/__tests__/group-card.test.tsx` | 維持 | group/variant編集・削除を正しい対象に向ける操作と空状態の表示。 |
| `apps/web/src/features/games/pages/games-page/group-form-sheet/__tests__/use-group-form-sheet.test.ts` | 維持 | trimと必須値、作成/更新の対象、失敗時フォーム保持を保護。 |
| `apps/web/src/features/games/pages/games-page/mixes-card/__tests__/mixes-card.test.tsx` | 維持 | mix構成表示と編集/削除対象の選択。destructiveの意味を表すstyleは維持。 |
| `apps/web/src/features/games/pages/games-page/variant-form-sheet/__tests__/use-variant-form-sheet.test.ts` | 維持 | group ID・任意値の正規化とcreate/updateの入力・失敗状態を保護。 |
| `apps/web/src/features/players/components/player-form/__tests__/use-player-form.test.ts` | 維持 | 名前長・trim・tag IDとmemoの保存入力。Players一覧統合が通らない境界も維持。 |
| `apps/web/src/features/players/components/player-form/player-form.test.tsx` | 維持 | 実フォームの名前・memo・tag操作とエラー表示。accessible editor名は親担当のE2E回帰で補強。 |
| `apps/web/src/features/players/components/player-tag-input/player-tag-input.test.tsx` | 維持 | 名前検索・色付きtag選択・新規作成・除去操作を保護。 |
| `apps/web/src/features/players/hooks/__tests__/use-player-detail.test.ts` | 維持 | IDごとのquery、キャッシュ済みdetail維持、memo更新と削除後の状態を保護。 |
| `apps/web/src/features/players/hooks/__tests__/use-player-tags.test.ts` | 維持 | tag create/update/deleteの楽観状態と失敗・pendingを保護。 |
| `apps/web/src/features/players/hooks/__tests__/use-players.test.ts` | 維持 | 検索key・tagとの絞込、memo除去・更新、既取得結果とqueryエラーを保護。 |
| `apps/web/src/features/players/hooks/__tests__/use-table-players.test.ts` | 維持 | 卓playerの追加・移動・離脱、session識別とキャッシュ更新。ライブ連携を含むため保護を残す。 |
| `apps/web/src/features/players/pages/player-detail-page/__tests__/player-detail-page.test.tsx` | 維持 | detailの名前・tag・memo、初期error・not found、編集操作を保護。一覧統合ではdetailを代替しない。 |
| `apps/web/src/features/players/pages/player-detail-page/__tests__/use-player-detail-page.test.ts` | 維持 | detail編集の初期値・cancel・保存と削除後の遷移を保護。 |
| `apps/web/src/features/players/pages/player-detail-page/delete-player-dialog/delete-player-dialog.test.tsx` | 維持 | 対象名付き削除確認、cancel、pending中二重実行防止。 |
| `apps/web/src/features/players/pages/player-detail-page/player-actions-drawer/player-actions-drawer.test.tsx` | 維持 | 編集・削除・閉じる操作を名前で選べることを保護。 |
| `apps/web/src/features/players/pages/player-detail-page/player-detail-skeleton/__tests__/player-detail-skeleton.test.tsx` | 削除 | 装飾class/node個数だけの確認を削除。対応するlist/detailでloadingをempty/errorと区別する挙動は維持。個々の装飾配置に新たなunitテストは置かない。 |
| `apps/web/src/features/players/pages/player-detail-page/top-bar/__tests__/top-bar.test.tsx` | 維持 | 各詳細ページの対象名/戻るリンク/メニューをユーザー操作で保護。別entityのtop barは対象ルートが異なるため一律には削除しない。 |
| `apps/web/src/features/players/pages/players-page/player-list-card/__tests__/player-list-card-skeleton.test.tsx` | 削除 | 装飾class/node個数だけの確認を削除。対応するlist/detailでloadingをempty/errorと区別する挙動は維持。個々の装飾配置に新たなunitテストは置かない。 |
| `apps/web/src/features/players/pages/players-page/player-list-card/__tests__/player-list-card.test.tsx` | 整理・強化 | 名前・tagの省略表示と詳細リンクを維持。固定row高さのclass確認を削除。 |
| `apps/web/src/features/players/pages/players-page/player-list/__tests__/player-list.test.tsx` | 整理・強化 | 検索結果なしと未登録、初期エラーとキャッシュ済みerrorを区別。固定skeleton個数を削除。 |
| `apps/web/src/features/players/pages/players-page/player-search/__tests__/player-search.test.tsx` | 削除・統合 | controlled inputの値/文字callback3本を削除。players-page.integration.test.tsxの実名前/tag検索へ統合。 |
| `apps/web/src/features/rooms/components/blind-level-editor/__tests__/use-blind-level-editor.test.ts` | 整理・強化 | 追加・削除・再採番・編集・DnD順序変更を維持。sensors/handlerが存在するだけの確認を削除。 |
| `apps/web/src/features/rooms/components/blind-level-editor/blind-level-editor.test.tsx` | 維持 | 実cell入力、無効数値、auto-fill、third blind、mix切替と取得失敗を保護。 |
| `apps/web/src/features/rooms/components/blind-level-editor/blind-level-input/blind-level-input.test.tsx` | 整理・強化 | 数値text入力・ラベル・エラー解除を維持。class mergeのみ削除。SA2-70のinset focus-ring回帰は実不具合のため残す。 |
| `apps/web/src/features/rooms/components/blind-level-editor/blind-structure-table/blind-structure-table.test.tsx` | 維持 | Addボタンが親formを誤submitしないHTML操作契約。 |
| `apps/web/src/features/rooms/components/blind-level-editor/empty-game-set-rows/__tests__/use-empty-game-set-rows-view.test.ts` | 維持 | third slot・auto-fill・不正なdurationの入力挙動を保護。 |
| `apps/web/src/features/rooms/components/blind-level-editor/level-patterns-sheet/__tests__/use-level-patterns-sheet.test.ts` | 維持 | 保存patternのレベル別game setと編集rerenderでの保持を保護。 |
| `apps/web/src/features/rooms/components/delete-game-dialog/__tests__/delete-game-dialog.test.tsx` | 維持 | 削除対象を示したconfirm/cancelとpendingガードを保護。 |
| `apps/web/src/features/rooms/components/game-actions-drawer/__tests__/game-actions-drawer.test.tsx` | 維持 | edit/archive/restore/deleteの利用可能な操作と正しいcallbackを保護。 |
| `apps/web/src/features/rooms/components/ring-game-form/__tests__/use-ring-game-form.test.ts` | 維持 | 既存値の復元、数値・blind・mixの検証、clearをnullにする保存入力を保護。 |
| `apps/web/src/features/rooms/components/ring-game-form/ring-game-form.test.tsx` | 維持 | 実formの入力項目と外部Saveをform IDへ接続する契約。 |
| `apps/web/src/features/rooms/components/room-form/__tests__/use-room-form.test.ts` | 維持 | 緯度経度の同時指定・範囲・null化を保護。一覧作成統合にない位置情報の入力境界。 |
| `apps/web/src/features/rooms/components/room-form/location-picker/__tests__/maps-url.test.ts` | 維持 | Google Maps URLの許可条件、lookalikeドメイン・不正入力拒否。 |
| `apps/web/src/features/rooms/components/room-form/location-picker/__tests__/use-location-picker.test.ts` | 維持 | 空/trim検索、座標更新、GPS、Maps URLエラーからの状態復帰を保護。 |
| `apps/web/src/features/rooms/components/room-form/location-picker/location-picker.test.tsx` | 整理・強化 | 検索・位置取得ボタン・入力のユーザー操作を維持。labelのstyle class確認のみ削除。 |
| `apps/web/src/features/rooms/components/tournament-form-sheet/__tests__/use-tournament-form-sheet.test.ts` | 維持 | AI抽出のmerge、content key変更時resetと失敗/pendingを保護。 |
| `apps/web/src/features/rooms/components/tournament-form-sheet/ai-extract-input/__tests__/use-ai-extract-input.test.ts` | 維持 | ファイル読み込み失敗、枚数制限、画像/テキストから抽出requestを作る境界。 |
| `apps/web/src/features/rooms/components/tournament-form-sheet/tournament-form-sheet.test.tsx` | 維持 | 生成中のSave制限、抽出入力と既存formの表示・送信連携を保護。 |
| `apps/web/src/features/rooms/components/tournament-modal-content/__tests__/tournament-modal-content.test.tsx` | 維持 | エラー時にDetailsを開く、tab切替でformを保持、外部submit連携。 |
| `apps/web/src/features/rooms/components/tournament-modal-content/__tests__/use-tournament-modal-content.test.ts` | 維持 | レベル別game set維持、tab/編集中データと検証結果の連携を保護。 |
| `apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/__tests__/use-tournament-form.test.ts` | 維持 | 数値・任意memo・variantなどの保存変換、初期値復元と失敗境界。 |
| `apps/web/src/features/rooms/components/tournament-modal-content/tournament-form/tournament-form.test.tsx` | 維持 | 実フォーム項目と外部Save連携、既存入力が編集できる契約。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-blind-levels.test.ts` | 維持 | 一括保存・keyboard操作・削除/再順序・エラー時の既存レベル保持を保護。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-empty-games-row.test.ts` | 維持 | 未登録game setから正しいvariant/typeで追加する入力変換。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-empty-row.test.ts` | 維持 | 空cell・ゼロ・不正値を区別した次レベル追加とauto-fill。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-game-set-rows.test.ts` | 維持 | 複数game setのcell編集、数値変換、行の追加・削除。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-ring-games.test.ts` | 整理・強化 | 片側のsetQueryData spy確認を廃止。archive拒否時、active/archived両方の楽観移動とrefetch前の完全復元を確認。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-room-games.test.ts` | 維持 | wizardで利用するroom別game一覧と初期設定の投影・選択値を保護。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-rooms.test.ts` | 整理・強化 | update/delete/favoriteのrollback spyを廃止。mutation拒否前の楽観状態と、refetch保留中の元のroom/順序への復元を3シナリオで確認。共通QueryClient fixtureを再利用。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-sortable-level-row.test.ts` | 維持 | 不正duration/blindを保存しない、cell編集・空値と行操作の契約。 |
| `apps/web/src/features/rooms/hooks/__tests__/use-tournaments.test.ts` | 維持 | active/archivedのqueryと各mutation、キャッシュ保持・失敗時の状態。 |
| `apps/web/src/features/rooms/pages/room-detail-page/__tests__/room-detail-page.test.tsx` | 維持 | initial errorをnot foundと混同しない、cache保持、gameタブ・編集導線。 |
| `apps/web/src/features/rooms/pages/room-detail-page/__tests__/use-room-detail-page.test.ts` | 維持 | room ID選択、編集・削除・errorと遷移を保護。一覧統合の対象外。 |
| `apps/web/src/features/rooms/pages/room-detail-page/delete-room-dialog/__tests__/delete-room-dialog.test.tsx` | 維持 | room削除の対象名、cancel、pendingガードを保護。 |
| `apps/web/src/features/rooms/pages/room-detail-page/ring-game-tab/__tests__/use-ring-game-tab.test.ts` | 維持 | 編集初期値・archive/restoreと保存失敗、任意値clearの正しいpayload。 |
| `apps/web/src/features/rooms/pages/room-detail-page/ring-game-tab/ring-game-tab.test.tsx` | 維持 | active/archive切替と編集フォーム、取得error・retry・cancelの操作。 |
| `apps/web/src/features/rooms/pages/room-detail-page/room-actions-drawer/__tests__/room-actions-drawer.test.tsx` | 維持 | room edit/deleteと閉じる操作の選択を保護。 |
| `apps/web/src/features/rooms/pages/room-detail-page/room-detail-skeleton/__tests__/room-detail-skeleton.test.tsx` | 削除 | 装飾class/node個数だけの確認を削除。対応するlist/detailでloadingをempty/errorと区別する挙動は維持。個々の装飾配置に新たなunitテストは置かない。 |
| `apps/web/src/features/rooms/pages/room-detail-page/room-location-link/__tests__/room-location-link.test.tsx` | 維持 | 位置なしでリンクを出さず、有効な座標で外部Mapsリンクを構成する契約。 |
| `apps/web/src/features/rooms/pages/room-detail-page/top-bar/__tests__/top-bar.test.tsx` | 維持 | 各詳細ページの対象名/戻るリンク/メニューをユーザー操作で保護。別entityのtop barは対象ルートが異なるため一律には削除しない。 |
| `apps/web/src/features/rooms/pages/room-detail-page/tournament-tab/__tests__/use-tournament-tab.test.ts` | 維持 | レベル別game setの完全保存、編集default・save guard・archive/restoreの対象。 |
| `apps/web/src/features/rooms/pages/room-detail-page/tournament-tab/tournament-tab.test.tsx` | 維持 | active/archive一覧、ロード失敗、編集sheet/cancelとpending中操作。 |
| `apps/web/src/features/rooms/pages/rooms-page/__tests__/rooms-page.test.tsx` | 削除・統合 | 全hook/子要素mockのページ確認をcatalog-pages.integration.test.tsxへ統合。実保存・favorite・retryまで保護。 |
| `apps/web/src/features/rooms/pages/rooms-page/__tests__/use-rooms-page.test.ts` | 削除・統合 | mock状態の確認をcatalog-pages.integration.test.tsxへ統合。旧unhandledRejection抑止も廃止し、実保存拒否を検出。 |
| `apps/web/src/features/rooms/pages/rooms-page/room-list-card/__tests__/room-list-card-skeleton.test.tsx` | 削除 | 装飾class/node個数だけの確認を削除。対応するlist/detailでloadingをempty/errorと区別する挙動は維持。個々の装飾配置に新たなunitテストは置かない。 |
| `apps/web/src/features/rooms/pages/rooms-page/room-list-card/__tests__/room-list-card.test.tsx` | 維持 | roomリンク、memo/game数、favorite操作の遷移抑止を保護。 |
| `apps/web/src/features/rooms/pages/rooms-page/room-list/__tests__/room-list.test.tsx` | 整理・強化 | loading/empty/errorと既取得room維持を保護。固定skeleton個数だけ削除。 |
| `apps/web/src/features/rooms/utils/__tests__/blind-level-helpers.test.ts` | 維持 | level構造・順序・再番号付け、空値と0、third blind/mixの変換。分岐数で削らず別々の保存契約を残す。 |
| `apps/web/src/features/rooms/utils/__tests__/game-format.test.ts` | 維持 | blind・ante・variant・buy-inの省略/有効値を区別する表示規則。 |
| `apps/web/src/features/rooms/utils/__tests__/merge-extracted-tournament-data.test.ts` | 維持 | 部分抽出で既存値を壊さない、0と未指定の区別、レベル/game set構造のmerge。 |
| `apps/web/src/features/sessions/components/override-label/__tests__/override-label.test.tsx` | 維持 | 値が上書きされていることをユーザーに知らせるbadgeの有無。 |
| `apps/web/src/features/sessions/components/session-filter-bar/__tests__/use-session-filter-bar.test.ts` | 維持 | 選択条件表示、scope変更での条件解除、preset値の復元と保存。 |
| `apps/web/src/features/sessions/components/session-form-sheet/__tests__/session-form-sheet.test.tsx` | 維持 | open/closeと外部form IDへのsubmit接続を保護。 |
| `apps/web/src/features/sessions/components/session-wizard/__tests__/chip-purchase-rows.test.ts` | 維持 | 購入回数・費用のserialization/復元とゼロ・無効値の区別。 |
| `apps/web/src/features/sessions/components/session-wizard/__tests__/use-session-form-state.test.ts` | 維持 | 金額・開始終了時刻・日付またぎ・順位・購入内容のvalidationと保存入力。金融データ境界として維持。 |
| `apps/web/src/features/sessions/components/session-wizard/__tests__/use-session-wizard.test.ts` | 維持 | step順序、hidden入力のvalidation、manual/liveに応じた次へ/戻る状態。 |
| `apps/web/src/features/sessions/components/session-wizard/rules-step-body/cash-rules-step-body/cash-game-fields/cash-blind-fields/cash-blind-fields.test.tsx` | 維持 | third blindの出し分けとライブ時の編集制約。 |
| `apps/web/src/features/sessions/components/session-wizard/rules-step-body/cash-rules-step-body/cash-game-fields/cash-game-fields.test.tsx` | 維持 | ante・mix・卓人数の操作と既定値の表示。 |
| `apps/web/src/features/sessions/components/session-wizard/rules-step-body/rules-step-body.test.tsx` | 維持 | rule上書きbadge、game切替時の古い値解除と適切なfield表示。 |
| `apps/web/src/features/sessions/components/session-wizard/session-wizard.test.tsx` | 維持 | 実multi-stepフォームで入力・エラー・次へ・保存がつながることを保護。 |
| `apps/web/src/features/sessions/components/session-wizard/tournament-fields/chip-purchase-count-row/chip-purchase-count-row.test.tsx` | 維持 | 負数/小数回数を切り捨てて費用を誤算しない入力保護。 |
| `apps/web/src/features/sessions/hooks/__tests__/use-session-detail.test.ts` | 維持 | detail query、既取得cache保持、関連query更新、tag作成を保護。 |
| `apps/web/src/features/sessions/hooks/__tests__/use-sessions.test.ts` | 維持 | UTC日付・時刻またぎ・金額serialization、楽観一覧と既存ページ、ライブ再開。多数でも異なる保存回帰を保護。 |
| `apps/web/src/features/sessions/pages/session-detail-page/__tests__/session-detail-page.test.tsx` | 維持 | 既存値表示、編集可否、初期/背景error、ライブ同期と操作導線。 |
| `apps/web/src/features/sessions/pages/session-detail-page/__tests__/use-session-detail-page.test.ts` | 維持 | 編集・削除失敗、入力保持、live由来データの同期と遷移対象。 |
| `apps/web/src/features/sessions/pages/session-detail-page/delete-session-dialog/__tests__/delete-session-dialog.test.tsx` | 維持 | session削除confirm/cancelとpendingガード。 |
| `apps/web/src/features/sessions/pages/session-detail-page/session-actions-drawer/__tests__/session-actions-drawer.test.tsx` | 維持 | 編集/共有/削除の可用性と対象sessionの操作を保護。 |
| `apps/web/src/features/sessions/pages/session-detail-page/session-edit-form/__tests__/session-edit-form.test.tsx` | 維持 | rule/resultの実入力・任意値clearと保存可能な状態の連携。 |
| `apps/web/src/features/sessions/pages/session-detail-page/session-edit-form/__tests__/use-session-edit-form.test.ts` | 維持 | 保存済み値から編集defaultへの変換と変更後の送信値。 |
| `apps/web/src/features/sessions/pages/session-detail-page/session-pl-hero/__tests__/session-pl-hero.test.tsx` | 維持 | 損益の符号・EV・単位表示。正負の意味を示すstyleも保護。 |
| `apps/web/src/features/sessions/pages/session-detail-page/session-stat-list/__tests__/session-stat-list.test.tsx` | 維持 | 利用可能なstat行と欠損時の表示を保護。 |
| `apps/web/src/features/sessions/pages/session-detail-page/session-timeline/__tests__/session-timeline.test.tsx` | 維持 | 詳細からライブtimelineへのsession IDとreadOnlyの境界。特に編集不能であることはpropsであっても契約として残す。 |
| `apps/web/src/features/sessions/pages/session-detail-page/top-bar/__tests__/top-bar.test.tsx` | 維持 | 各詳細ページの対象名/戻るリンク/メニューをユーザー操作で保護。別entityのtop barは対象ルートが異なるため一律には削除しない。 |
| `apps/web/src/features/sessions/pages/sessions-page/__tests__/use-sessions-page.test.ts` | 維持 | フィルターとpreset、初回defaultの一度だけの適用、作成・編集導線の状態。 |
| `apps/web/src/features/sessions/pages/sessions-page/session-list-card/__tests__/session-list-card.test.tsx` | 維持 | 保存済み金額・unit・日付またぎ、session種別ごとのラベルとライブ由来表示。 |
| `apps/web/src/features/sessions/pages/sessions-page/session-list/__tests__/session-list.test.tsx` | 維持 | initial error/empty/loading、load more失敗でも既存行を保持する契約。 |
| `apps/web/src/features/sessions/pages/sessions-page/session-tag-manager/__tests__/use-session-tags.test.ts` | 維持 | tag CRUDと対象session、create/update/cancel状態。 |
| `apps/web/src/features/sessions/pages/sessions-page/session-tag-manager/session-tag-manager.test.tsx` | 維持 | tag編集sheetとcreate/delete/cancelの実操作。 |
| `apps/web/src/features/sessions/utils/__tests__/session-display.test.ts` | 維持 | session種別・金額・null/0・UTC・日付またぎ・game表示の変換。共通formatter単体と同一契約ではない。 |
| `apps/web/src/features/sessions/utils/__tests__/session-filters-helpers.test.ts` | 維持 | presetへの往復、表示modeとの互換性と無効条件の正規化。 |
| `apps/web/src/features/sessions/utils/__tests__/session-form-helpers.test.ts` | 維持 | UTC日付と時刻をformへ変換、rule上書き・任意値の正規化。 |
| `apps/web/src/features/sessions/utils/__tests__/share-session.test.ts` | 維持 | clipboard fallback、share拒否、日付またぎ/UTCと金額を含む共有内容。 |
| `apps/web/src/features/settings/pages/settings-page/__tests__/use-settings-page.test.ts` | 維持 | 設定のsignoutが統一された破棄手順へ委譲する安全上の接続を維持。 |
| `apps/web/src/features/settings/pages/settings-page/about-section/__tests__/use-about-section.test.ts` | 維持 | releaseなしfallback、最新版のリンク・表示入力。 |
| `apps/web/src/features/settings/pages/settings-page/about-section/about-section.test.tsx` | 維持 | バージョンとreleaseの外部リンク、情報欠損時の表示。 |
| `apps/web/src/features/settings/pages/settings-page/linked-accounts/__tests__/use-linked-accounts.test.ts` | 維持 | 認証methodに応じたlink/unlink可否、password設定失敗と唯一の認証手段の保護。 |
| `apps/web/src/features/settings/pages/settings-page/linked-accounts/linked-accounts.test.tsx` | 維持 | 実UIのprovider/password操作と削除guardを保護。 |
| `apps/web/src/features/settings/pages/settings-page/theme-setting/__tests__/use-theme-setting.test.ts` | 削除・統合 | 定数・icon・handler存在とtheme値の7本を削除。theme-setting.test.tsxをsystem/light/dark/未確定値の実選択で補強。 |
| `apps/web/src/features/settings/pages/settings-page/theme-setting/theme-setting.test.tsx` | 整理・強化 | 実UIでsystem/light/darkの選択と現在値・未確定値を確認。削除したhookの状態/定数確認を吸収。 |
| `apps/web/src/features/statistics/components/stats-filter-bar/__tests__/use-stats-filter-bar.test.ts` | 維持 | 期間・currency・game条件とpreset保存値の組合せ、schemaに適合する条件変更。 |
| `apps/web/src/features/statistics/hooks/__tests__/use-stats-filters.test.ts` | 維持 | URLのmerge/replaceと無効なfilter入力の扱い。 |
| `apps/web/src/features/statistics/pages/statistics-page/__tests__/stats-query-error.test.tsx` | 維持 | 取得失敗をalert表示しretryできる契約。 |
| `apps/web/src/features/statistics/pages/statistics-page/__tests__/use-statistics-page.test.ts` | 維持 | currency/scope選択、初回defaultとpristine条件の一度だけの適用。 |
| `apps/web/src/features/statistics/pages/statistics-page/breakdown-section/__tests__/use-breakdown-section.test.ts` | 維持 | 選択した集計group、query有効条件、ロード/エラー状態。 |
| `apps/web/src/features/statistics/pages/statistics-page/breakdown-section/breakdown-table/__tests__/breakdown-table.test.tsx` | 維持 | 正規化不能時のraw損益fallbackと空表示。colspanは表の意味上の構造として維持。 |
| `apps/web/src/features/statistics/pages/statistics-page/cash-game-stats/__tests__/use-cash-game-stats.test.ts` | 維持 | cash対象queryの有効条件、サマリーと失敗状態。 |
| `apps/web/src/features/statistics/pages/statistics-page/kpi-cards/__tests__/use-kpi-cards.test.ts` | 維持 | 業務指標・trend・unit・欠損時の表示規則。 |
| `apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/aligned-domains.test.ts` | 維持 | 正負のdomain・ゼロ位置整列・縮退データの数値規則。 |
| `apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/labels.test.ts` | 削除・統合 | formatCompactNumberへの単純転送に独自分岐がなく、同じ期待値3本を削除。utils/format-number.test.tsに集約。 |
| `apps/web/src/features/statistics/pages/statistics-page/pnl-graph/__tests__/use-pnl-graph.test.ts` | 維持 | SA2-98 sortKey順序、axis/EV/filter切替、各graph表示値の計算を保護。 |
| `apps/web/src/features/statistics/pages/statistics-page/tournament-stats/__tests__/use-tournament-stats.test.ts` | 維持 | tournament対象queryの有効条件、サマリーと失敗状態。 |
| `apps/web/src/features/statistics/utils/__tests__/aggregate-pnl-points.test.ts` | 整理・強化 | 例ベースのUTC/損益/EV/axis境界を維持。seed=20260905、150生成例で入力順序不変・入力非破壊を追加。期待する計算式を複製せず、同じ集合の順序を変えるproperty。 |
| `apps/web/src/features/statistics/utils/__tests__/format-stats.test.ts` | 維持 | percent・normalized値・nullを統計として表す独自規則。汎用formatterの重複だけではない。 |
| `apps/web/src/features/statistics/utils/__tests__/stats-filters.test.ts` | 維持 | URL入力のvalidation/defaultと無効値処理。外部境界なのでschema定義だけでも安全な読み込み契約がある。 |
| `apps/web/src/features/update-notes/components/update-notes-sheet/__tests__/use-update-notes-sheet.test.tsx` | 維持 | 初回/既読・最新versionでの自動表示と閲覧後の状態更新。 |
| `apps/web/src/features/update-notes/components/update-notes-sheet/update-notes-sheet.test.tsx` | 維持 | release category/content表示、閉じる/Escapeと既読操作の接続。 |
| `apps/web/src/features/update-notes/hooks/__tests__/use-update-notes-viewed.test.ts` | 維持 | 既読version集合のunion、楽観更新・読み込み/更新失敗とquery gate。 |
| `apps/web/src/features/update-notes/utils/__tests__/parse-release-body.test.ts` | 維持 | 見出しとbulletからrelease categoryを抽出し欠損を扱う変換。 |
| `apps/web/src/features/update-notes/utils/__tests__/should-auto-open-update-notes.test.ts` | 維持 | 完全一致version、初回/既読/loading、prefix誤一致と反復auto-openを防ぐ。 |
| `apps/web/src/shared/components/app-navigation/app-navigation.test.tsx` | 維持 | desktop/mobileで選択中リンクのaria-current、非選択との差を保護。 |
| `apps/web/src/shared/components/auth-form-shell/auth-form-shell.test.tsx` | 維持 | provider/footerの認証導線とフォーム内容をユーザーが操作できる契約。 |
| `apps/web/src/shared/components/authenticated-shell/__tests__/use-authenticated-shell.test.ts` | 維持 | 認証shellの表示条件とオンライン/ライブ連携状態を保護。 |
| `apps/web/src/shared/components/authenticated-shell/mobile-nav/__tests__/use-mobile-nav.test.ts` | 維持 | 現在route、live/session種別、wizard/popover操作を適切な導線へ結び付ける契約。 |
| `apps/web/src/shared/components/authenticated-shell/mobile-nav/mobile-nav.test.tsx` | 維持 | モバイルの遷移・ライブセッション導線、選択中項目のaria-currentを保護。 |
| `apps/web/src/shared/components/authenticated-shell/online-status-bar/__tests__/use-online-status-bar.test.ts` | 維持 | offline→同期→back onlineの表示タイマー、再offlineとunmount時の解除。 |
| `apps/web/src/shared/components/authenticated-shell/sidebar-nav/mode-toggle/mode-toggle.test.tsx` | 維持 | 現在themeから切り替える実ユーザー操作。 |
| `apps/web/src/shared/components/authenticated-shell/sidebar-nav/sidebar-nav.test.tsx` | 整理・強化 | 選択中の項目をaria-currentで確認するよう変更。外観classには依存しない。 |
| `apps/web/src/shared/components/authenticated-shell/sidebar-nav/user-menu/__tests__/use-user-menu.test.ts` | 維持 | 認証状態と中央signout処理への接続。キャッシュ破棄の入口を残す。 |
| `apps/web/src/shared/components/authenticated-shell/sidebar-nav/user-menu/user-menu.test.tsx` | 維持 | loading/認証あり/なしの表示と設定・signout操作を保護。 |
| `apps/web/src/shared/components/chip-purchases-editor/__tests__/chip-purchases-editor.test.tsx` | 維持 | 購入の追加/除去・値とfocus移動。金額編集の実操作契約。 |
| `apps/web/src/shared/components/filter-chip-bar/__tests__/filter-chip.test.tsx` | 維持 | selected/invalidの意味と優先順。状態を伝えるsemantic styleは無条件に削除しない。 |
| `apps/web/src/shared/components/filter-chip-bar/__tests__/filter-date-range.test.tsx` | 維持 | 開始終了日のlabel/ID関連付けと変更操作。 |
| `apps/web/src/shared/components/filter-presets/__tests__/filter-presets-sheet.test.tsx` | 維持 | preset作成/編集/適用・default切替と失敗表示。子hook mockでも未代替の操作契約。 |
| `apps/web/src/shared/components/filter-presets/__tests__/use-filter-presets-sheet.test.ts` | 維持 | create/edit/deleteのsheet状態遷移、defaultとmutation失敗後の保持。 |
| `apps/web/src/shared/components/filter-presets/delete-preset-dialog/delete-preset-dialog.test.tsx` | 維持 | preset対象名・削除confirm/cancel・pendingを保護。 |
| `apps/web/src/shared/components/form-sheet/form-sheet.test.tsx` | 維持 | 外部HTML formのsubmit、Save guard、cancel、dismiss制御。多画面共通の実primitive契約。 |
| `apps/web/src/shared/components/management/entity-list-item/__tests__/use-entity-list-item.test.ts` | 維持 | controlled/uncontrolled展開、削除/編集のevent伝播と状態。 |
| `apps/web/src/shared/components/management/tag-manager/__tests__/use-tag-manager.test.ts` | 維持 | create/edit/deleteの別状態、固有で安定したform IDと対象選択。 |
| `apps/web/src/shared/components/management/tag-name-form/__tests__/use-tag-name-form.test.ts` | 維持 | trimと文字数・必須検証、変更に応じたlabelと保存値。 |
| `apps/web/src/shared/components/mix-form-sheet/__tests__/use-mix-form-sheet.test.ts` | 維持 | groupとgame IDの順序、最小構成数、作成/更新・失敗時状態。 |
| `apps/web/src/shared/components/mix-games-editor/__tests__/mix-games-editor.test.tsx` | 維持 | 実cell入力・group除去・無効値のアクセシブルな表示。 |
| `apps/web/src/shared/components/mix-games-editor/__tests__/use-mix-games-editor.test.ts` | 維持 | bucket操作、ante clear、行データ変更の独自変換。 |
| `apps/web/src/shared/components/ui/field/__tests__/field.test.tsx` | 整理・強化 | label/errorのID関連付けとaria-invalidを維持。任意class/data props転送だけの確認を削除。 |
| `apps/web/src/shared/components/ui/input-group/__tests__/input-group.test.tsx` | 整理・強化 | sectionのaccessible nameと子入力を維持。className転送のみ削除。 |
| `apps/web/src/shared/components/ui/rich-text-content/__tests__/rich-text-content.test.tsx` | 整理・強化 | script/イベント属性除去、許可リンクと更新時sanitizeを維持。class mergeだけ削除。 |
| `apps/web/src/shared/components/ui/rich-text-editor/__tests__/rich-text-editor.test.tsx` | 維持 | エディター入力/command・disabled等の契約を維持。accessible name回帰は親担当で実ブラウザーaxeと併せて補強。 |
| `apps/web/src/shared/components/ui/rich-text-editor/__tests__/use-rich-text-editor.test.ts` | 維持 | sanitize、selection/commandと入力更新、editor eventの安全な処理を保護。 |
| `apps/web/src/shared/components/ui/tabs/tabs.test.tsx` | 整理・強化 | CSS変数の個数確認を廃止し、実clickとArrowRight/Home、disabledのskip、選択panelの関連付けへ置換。 |
| `apps/web/src/shared/components/ui/tag-input/tag-input.test.tsx` | 維持 | tag選択/作成/除去とEscapeの実操作を保護。 |
| `apps/web/src/shared/components/ui/tag-picker-base/__tests__/use-tag-picker-base.test.ts` | 維持 | 名前一致・候補作成・選択状態の再計算。個別入力UIだけでは覆わない共通変換。 |
| `apps/web/src/shared/components/variant-select/__tests__/use-variant-select.test.ts` | 維持 | 未知値・group/filter検索、候補作成失敗・cache変更の状態を保護。 |
| `apps/web/src/shared/components/variant-select/__tests__/variant-select.test.tsx` | 維持 | 実comboboxのkeyboard、選択候補、作成操作を保護。 |
| `apps/web/src/shared/hooks/__tests__/use-default-filter-preset.test.ts` | 整理・強化 | 最初の成功時だけdefault適用、失敗後retry・identity変更を維持。戻り値undefinedだけの確認を削除。 |
| `apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts` | 維持 | 時間進行・停止・未来開始時刻とinterval cleanup。 |
| `apps/web/src/shared/hooks/__tests__/use-filter-presets.test.ts` | 維持 | 画面/ユーザーに対応するquery、CRUD・rollback・default一意性を保護。 |
| `apps/web/src/shared/hooks/__tests__/use-game-groups.test.ts` | 維持 | 3系統masterのlookup、mix展開、group fallbackとloading/error。 |
| `apps/web/src/shared/hooks/__tests__/use-geolocation.test.ts` | 維持 | 無効化/自動・手動取得、権限/失敗、unmount後に状態変更しない。 |
| `apps/web/src/shared/hooks/__tests__/use-media-query.test.ts` | 維持 | media query切替の再購読、change反映、unmountで解除。 |
| `apps/web/src/shared/hooks/__tests__/use-mix-master-editing.test.ts` | 維持 | master rename時も入力済み金額を失わず再seedする回帰。 |
| `apps/web/src/shared/hooks/__tests__/use-mobile-nav-popover.test.ts` | 整理・強化 | 状態shape確認や同じtoggle反復を2シナリオへ統合。controlled開閉とaction後closeを維持。 |
| `apps/web/src/shared/hooks/__tests__/use-online-status.test.ts` | 維持 | online/offlineイベント反映とlistener解除。 |
| `apps/web/src/shared/hooks/__tests__/use-pwa-update.test.ts` | 維持 | 新versionがある場合だけreload actionを実行するhook境界。service worker配信/upgrade自体は実ブラウザー担当。 |
| `apps/web/src/shared/hooks/__tests__/use-set-password-form.test.ts` | 維持 | password不一致/最低長と認証エラーfallback。 |
| `apps/web/src/shared/hooks/__tests__/use-sign-out.test.ts` | 維持 | 永続cache破棄完了を待つこと、失敗時に先に遷移しないこと。実IndexedDBのアカウント分離E2Eと補完。 |
| `apps/web/src/shared/hooks/__tests__/use-variant-labels.test.ts` | 維持 | variantの識別子からlabelへの変換、未知値/caseのfallback。 |
| `apps/web/src/shared/hooks/__tests__/use-variant-scope.test.ts` | 維持 | group/type変更時のscope再設定と初期label。 |
| `apps/web/src/shared/lib/__tests__/form-fields.test.ts` | 維持 | 金額入力textの整数/小数・非有限値・任意nullの正規化。実装の全分岐義務ではなく入力破損防止として維持。 |
| `apps/web/src/shared/lib/__tests__/mix-games.test.ts` | 維持 | group行のnormalize/hydrate、順序・金額・nullの独自変換。 |
| `apps/web/src/shared/lib/__tests__/period-filter.test.ts` | 維持 | UTC期間境界、custom rangeの往復とserialize。 |
| `apps/web/src/shared/lib/__tests__/pwa-manifest.test.ts` | 維持 | start_urlが現在の有効routeを指すことと起動設定の互換性。 |
| `apps/web/src/utils/__tests__/check-rules-path.test.ts` | 維持 | Windows/POSIXパスと対象外判定。ルール検査の誤検出回帰。 |
| `apps/web/src/utils/__tests__/format-elapsed-time.test.ts` | 維持 | 欠損/未来の時刻、durationの区切りと表示。 |
| `apps/web/src/utils/__tests__/format-number.test.ts` | 整理・強化 | locale固定・10k/単位/丸め境界を維持。同一1234.5の完全重複だけ削除し、pnl軸のforward-only testもここへ集約。 |
| `apps/web/src/utils/__tests__/format-profit-loss.test.ts` | 維持 | 金額の符号、unit、normalized精度という損益固有規則を保護。 |
| `apps/web/src/utils/__tests__/query-persistence.test.ts` | 維持 | 成功queryだけを永続化するpredicate。実IndexedDBやユーザー切替の保証と混同せずE2Eで補完。 |
| `apps/web/src/utils/__tests__/table-size-colors.test.ts` | 削除・統合 | 色辞書のkeys・class形式・色数・自分の辞書との一致を確認するテストを削除。卓人数は数値labelで表示され、任意の色選択は保存/入力契約ではない。 |

## 新規テストと第一波の補足

| ファイル | 役割 |
| --- | --- |
| `apps/web/src/__tests__/catalog-pages.integration.test.tsx` | Currencies/Rooms各7シナリオ。遅い初回取得、空から新規/cancel、必須検証、pending二重送信防止、拒否後入力保持/retry、list error/retry、favorite成功/rollback。 |
| `apps/web/src/features/players/pages/players-page/__tests__/players-page.integration.test.tsx` | 別担当の実page/HTTP統合。名前/tag検索・作成・新規tag・失敗/retryを保護し、旧親2ファイルとsearch単体の代替。 |
| `apps/web/src/utils/__tests__/optimistic-query-updates.test.ts` | 第一波: 同じqueryの並行変更と失敗順序、edit/delete共存、QueryClient間の分離、refetch後の新グループを保護。 |
| `apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts` | 第一波: 実際に2 mutationをpendingにし、片方の失敗が他方を失わせず、最後のsettleまでrefetchしないことを検証。edit/delete/favorite rollbackもrefetchを保留して確認。 |

## 検証範囲と限界

- 変更テストと削除元の代替テストを対象にしたscoped Vitestは31ファイル・371テスト成功（web-dom/web-node、14.38秒）。web型検査成功、担当30ファイルのUltracite検査成功。既存routeテストからjsdomのscrollTo未実装通知が出るが、Vitestの未処理エラーはない。全workspaceの最終signalはCIで確認する。
- 維持したmock利用テストは、保存値の正規化・操作可否・タイマー等の独立契約を担う。mockの関数呼び出しが通ったことを、API認可・DB永続化・ブラウザーの実挙動の証明には数えない。
- 並行mutationのhelperはcurrency取引のcreate/edit/deleteを協調させる。PRレビューへの対応で、処理中のrefetch結果を復旧基準へ反映し、load moreで増えたページもrollback後に保持するよう補強した。groupへ参加しない別の楽観的writerの差分合成までは保証しない。
- 対象ファイルを残す判断とテスト環境全体の完成は別である。PWA更新、IndexedDBのアカウント分離、認証、実DB、ライブセッションの競合は担当の統合/E2Eおよび別レビューと合わせて確認する。

## dev 更新の取り込み

`37371fd8..8d3dbdc2` の Currencies・Players・Rooms 全差分を確認した。この範囲の上流変更は説明コメントの除去で、新しい動作・テスト契約の追加はない。競合17ファイルは、9ファイルで今回の再編・並行更新保護を維持し、8ファイルで上流の個別差分を照合したうえで承認済みの削除を維持した。最新のコメント規約に合わせて追加した説明コメントも整理し、更新理由はこの文書と設計文書に保持する。解消後は関係する8テストファイルとCatalog・PlayersのUI統合を合わせた10ファイル・135テストが成功し、3機能とCatalog統合の284ファイルのUltracite検査も成功した。

以下のSettings Passkeys 3ファイルは上流で追加されたため、当初の222ファイルおよび全体407ファイルの判定数に含めない。テスト名・expect・実hook／componentを個別に確認した。

| 上流追加ファイル | 判定・理由 |
| --- | --- |
| `apps/web/src/features/settings/pages/settings-page/passkeys/__tests__/use-add-passkey-form.test.ts` | 維持。実フォームのtrim・必須・50文字境界に加え、登録の成功、利用者の取り消し、登録済み端末、SDKの失敗応答・結果欠落を区別する。成功時だけ閉じる・再取得する・自動登録を再許可する契約があり、エラー分類関数の写しではない。 |
| `apps/web/src/features/settings/pages/settings-page/passkeys/__tests__/use-passkeys.test.ts` | 維持。実hookで取得失敗と空一覧を区別し、削除／名前変更の対象・失敗時のフォーム保持・削除後の自動再登録停止を検証する。deferred応答によるpending中の二重要求防止と、古い取得応答が新しい成功を上書きしない保護もある。 |
| `apps/web/src/features/settings/pages/settings-page/passkeys/passkeys.test.tsx` | 維持。実component・hook・フォームを操作し、削除確認／cancel、対象切り替え時の名前初期化、追加cancel後のリセット、取得失敗の表示とRetry中の操作制限・復旧、WebAuthn非対応の案内を検証する。hookの戻り値をmockしたprops確認ではない。 |

Passkeysの3ファイル・58テストは解消後のscoped実行で成功した。認証SDKを境界でmockするため、実際の資格情報登録・ログイン、サーバー所有権、DB永続化を証明しない。UIテストはDrawerも置換しており、portal・focus・モバイルのシート挙動は保証範囲外である。認証utility・shared libraryの上流追加テストは別担当のレビュー記録を参照する。

## CI coverage 監査による補完

CI `33939497108` のcoverageで未実行sourceを確認し、`UpdateStackEditor` → `TournamentInfoFields` の人数編集が既存hookテストでも未保護と判定した。既存 `use-update-stack-editor.test.ts` はcash gameの5ケースで、トーナメントの `Remaining Players` / `Total Entries` を変更して保存する経路を通らない。新規スタック入力や平均スタック計算の別テストでは、この履歴編集の配線を代替できない。

`apps/web/src/features/live-sessions/components/event-editors/event-editor/event-editor.test.tsx` に2ケースを追加した。実 `EventEditor` の種類判定から `UpdateStackEditor`、hook、TanStack Form、入力fieldまでをmockせず、人数の変更を数値で保存し、既存のstack・chip購入情報・発生時刻を保持することを検証する。もう1ケースは負のstackで保存しないことと人数の入力保持、0へ修正した後の再送を確認する。hook単体への重複追加や、現在の呼出元から表示されないchip購入count入力の全分岐追加は行わない。

追加2ケースは既存実装で成功し、source修正は不要だった。web型検査、対象Ultracite、`check:rules`、全391テストファイルの検出・重複検査が成功し、別担当の読み取りレビューも指摘なしだった。保存callbackを境界にするUI連携テストであり、HTTP・DB永続化・sheetの開閉を保証するものではない。0%という数値ではなく、到達可能な履歴保存契約の欠落を補完した。
