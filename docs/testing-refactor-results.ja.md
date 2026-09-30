**テスト再編の実施記録**

2026-09-05 / 基準HEAD `37371fd84f2a6c5fd32e726d2793c3489f455ca3`。全407既存ファイルと最新devの追加12ファイルを対象に、維持・統合・置換・削除の判断と不足する検証を確定した。実装HEAD `5dac8492` の [全CI成功・初回計測](https://github.com/HIRO15254/sapphire2/actions/runs/33939630270) を以下に記録する。この計測から見つかった履歴編集の不足も2ケース補完した。最新のCI結果とレビュー先は [PR #603](https://github.com/HIRO15254/sapphire2/pull/603)。

個別根拠は [Web 223ファイル](testing-web-review.ja.md)（主表222＋currency第一波1）、[live 90ファイル](testing-live-review.ja.md)、[backend 90ファイル](testing-backend-review.ja.md) と下表4ファイルを参照する。独立した機械照合で407件の欠落・重複・処置と実ファイルの不一致がないことを確認した。[初期分類](testing-migration-inventory.ja.md) のreview等は初期の候補ラベルであり、最終処置はこれらのレビュー記録に置く。

最新dev `8d3dbdc2` の統合で加わったパスキー・OAuth継続関連12ファイルも別枠でレビューした。各領域の追補に処置を記録し、開始時点の407件には混ぜない。認証機能とコメント整理を維持し、古いmock・rollbackの推奨が残っていた `docs/design/testing-and-tooling.md` も新方針へ整合した。

初回再編の最新dev比較では41ファイルを削除・統合、18ファイルを追加、2ファイルを移動し、63既存ファイルの検証を更新した。全419既存ファイルに対する処置が一意に存在し、未記録は0件。当時は391 Vitestファイルと5 E2Eファイルで、Bun専用migrationはVitest内でskipし専用runnerで実行する。その後のPRレビューへの対応は末尾に追記する。

| ファイル | 処置 | 根拠・代替 |
|---|---|---|
| `apps/web/src/features/players/pages/players-page/__tests__/players-page.test.tsx` | 統合・削除 | page hookと子をmockするprops確認を、players-page.integration.test.tsxの実page/hook/form/QueryClient/HTTP 7シナリオへ統合。実保存とreloadはPlaywrightが補完 |
| `apps/web/src/features/players/pages/players-page/__tests__/use-players-page.test.ts` | 統合・削除 | 検索・入力・送信・失敗を上記実UIへ統合。未処理Promiseをlistenerで隠すテストも除去し、拒否時の入力保持・再送・toastを確認 |
| `apps/web/src/utils/__tests__/optimistic-update.test.ts` | 維持 | 単一/複数/無限cache、未取得時の非生成、nullクリア、取消とrollbackの独立契約。並行更新列は新optimistic-query-updates.test.tsで補完 |
| `apps/web/src/utils/__tests__/vite-plugin-github-releases.test.ts` | 移動・統合 | production取得の認証header・公開release抽出・HTTP失敗をplugins配下へ集約し、外部通信なしのfixture/空fixtureを補完。重複するdraft/prerelease確認は一本化 |

**追加した実体境界**

| 対象 | 新しい検証 |
|---|---|
| 認証・認可 | 全procedureを実未認証callerで呼びUNAUTHORIZEDを要求。重点namespaceはvalid入力でも拒否し、DB無変更を確認。他accountのID・JOIN・cursor・読取/更新拒否 |
| D1・Drizzle | 全migrationを適用したDBでCRUD、100 bind超のchunk、2つ目のchunk失敗時の全rollback、ページング、FK/UNIQUE/cascade、宣言と実schemaの一致 |
| live session | cashの開始・増資・完了台帳・新caller読戻し・再開、tournamentの完了と再開禁止、同時開始の単一成功、event順序 |
| 画面 | Players/Currencies/Roomsを実UI・Router・QueryClient・フォーム・tRPC HTTP＋MSWで検証。pending、検索、検証エラー、保存、二重送信防止、失敗時保持/retry |
| 更新競合 | currency取引create/edit/deleteが同時pendingになる応答順を制御し、他更新の消失と早すぎるrefetchを防止。Room等のrollbackもrefetch前の実状態へ変更 |
| 実HTTP | Better Auth登録・ログイン、OAuth DCR/PKCE/同意/token、MCP toolとCookie tRPCの同じDBへの到達、別account隔離、誤token拒否 |
| パスキー | 実Settingsで登録→reload→logoutでsession消失→WebAuthnログインで同一account復帰。Chromium仮想認証器で実challenge・署名・サーバー検証を通す |
| ブラウザー | 保存後reload、同contextのlogout→reload→B、実IndexedDB・Service Workerのオフライン再読込/復帰、mobileフォームのaxe、desktop案内 |
| 不変条件・静的検査 | 損益集計の入力順序/非破壊property、全spec検出照合、追加基盤の型、Node/jsdom coverage、固定runtimeとCI artifact |

**新しい検証で再現・修正した不具合**

- currencyTransactionの2ページ目でDateをD1へ直接bindしていた。Drizzleのtimestamp encoderで格納値へ変換する。
- player.updateのタグ単独/id単独入力が空のSETで失敗していた。親UPDATEが必要なときだけbatchへ追加する。
- currency取引の並行edit/deleteで失敗した操作のsnapshotが他操作を消し、create完了もpending操作をrefetchで上書きした。同じqueryへの更新を協調させ、失敗操作だけ除去し、最後に再取得する。
- Players/Currencies/Roomsの作成やfavorite拒否が未処理Promiseになっていた。エラーを処理して、既存MutationCacheの通知とフォーム入力を維持する。
- リッチテキストのメモ入力にaccessible nameがなかった。実textboxへrole・label・multilineを付与する。
- Better Auth 1.6.0の同意拒否redirectがOAuth stateと既存queryを保持しなかった。依存のredirect組立だけをBun patchで修正する。

いずれも動作の失敗を再現してから修正した。起動環境のエラーやlocator調整をバグ修正のredへ数えていない。重要なrollback・DB原子性は限定した故障注入でも検出力を確認し、故障コードを復元した。検出漏れチェックには一時的な未割り当てspecを置き、意図した失敗を確認して削除した。

**確認結果と範囲**

初回計測のLinux CIでは静的検査、以下4群、集約ciがすべて成功した。型・テスト基盤の型・lint・check:rules・当時390ファイルの検出照合も成功。意図しないskipと再試行はない。

| 実行群 | 成功件数 | 実行時間 |
|---|---:|---:|
| Vitest unit / UI + coverage | 375ファイル・6,143ケース | 265.16秒 |
| 実D1統合（全52migration） | 8ファイル・36ケース | 27.95秒 |
| Bun SQLite migration / seed復元 | 7ファイル・55ケース | 専用実行step 1秒未満 |
| Playwright（OAuth・WebAuthn・PWAを含む） | 5ファイル・10ケース | 31.2秒 |

合計6,244ケース成功。Vitest内の7ファイル・55ケースのskipは、表のBun専用実行と一対一で対応する。ローカルWindowsでも関連355ファイル・6,045ケース、D1・Bun・ブラウザーの各対象を検証した。大量パスで起きたpre-commitの引数長エラーはGitからのchanged検出へ修正した。E2Eだけの追加でVitestの関連対象が0となる場合も正常終了することを確認し、E2E自身は専用runnerで実行する。

CI全体は約5分。[直近の旧CI](https://github.com/HIRO15254/sapphire2/actions/runs/33857087757) は約4分27秒だったが、runtime・対象・coverageの有無が違うため速度改善率として比較しない。新しい構成の所要時間を次回以降の基準にする。Node/jsdom coverageは722実装ファイルを集計し、statement 85.40%、branch 81.75%、function 82.87%、line 85.20%。未importの実装も含めるが、workerdの別processを計測した数値ではない。実D1で全機能の全状態を網羅したとは扱わず、独立した純粋関数・状態・入力契約のunitも維持する。coverage・JUnit/JSON・ブラウザーレポートはCIのartifactに保存した。

**未計測ファイルの判断と補完**

初回のline coverageが0%だった15ファイルも実装と既存検証を照合した。トーナメントのスタック履歴でRemaining Players / Total Entriesを変更して保存する経路はcash用hookテストでは保護されていなかったため、実EventEditor→hook→フォーム→保存callbackの2ケースを追加した。人数の数値化・既存stack/rebuy記録の保持、負のstack拒否後の入力保持と修正保存を確認する。サーバーやDBの検証には数えない。

ほかの履歴編集・完了フォームは実hookの金額・必須・送信payloadで保護され、API contextは実HTTP/E2Eで通る。archived一覧の復元処理と子UIは保護されるが、「Show archived→行選択→Restore」の画面接続自体は直接検証していない。固定fallback・loader・skeletonは低リスクの表示として追加不要と判断した。カバレッジ100%のために到達しない分岐や装飾のテストを増やさない。

Stryker全体実行、全面的な画像snapshot、別site間の第三者Cookie制限、実外部IdP、PWAの実デプロイ更新、本番D1の分散障害は今回の必須gateに含めない。PWA更新通知の操作は既存hookテスト、SWとキャッシュは実ブラウザーで役割を分けている。実行方法と依存patchの扱いは [環境ガイド](testing-environment.ja.md) を参照する。

**PRレビューへの対応**

- `beginOptimisticQueryUpdate` の復旧基準を、処理開始時の固定値から途中の取得結果を反映する値へ変更した。通常のrefetchでは新しいサーバー値を基準にし、追加ページ取得では既存ページの基準値と新しいページを合成してから未失敗の操作を再適用する。失敗した編集を新たな基準へ混ぜず、読み込んだページも消さない。更新終了時に取得が残る場合は購読を応答・取消・エラーまで保持し、「画面離脱→更新失敗→遅いページ応答」でも失敗した楽観値を復活させない。
- 最初の適用が例外になった場合は部分的な書込みを戻し、終了できない操作を残さない。再適用できない操作の楽観表示は除去し、他操作とサーバー値を保持する。終了処理の二重呼出しや、キャッシュ削除後の古い処理が新しい更新群を壊さないようにした。
- `test:unit` のproject名列挙を `--project=!api-integration` に置換した。今回追加した `testing` projectの2ケースが旧コマンドでは未検出になることを確認し、修正後に同じコマンドで2ケースが実行・成功した。新projectは検出照合と型検査にも登録し、392 Vitestファイルに未割当・重複がないことを確認した。
- 実D1とE2Eで、本番 `wrangler.toml` のcompatibility dateとflagsを読むhelperを共有した。日付未指定は明示的に拒否し、警告経由の外部更新確認も抑止する。設定読取り2ケース、実D1 36ケース、desktop E2E 1ケースが成功した。

キャッシュ側の初期10ケースと応答逆順1ケースは、期待値の不一致で失敗することを確認してから修正した。追加取得の取消で古い値が復活するという静的レビューの候補は現TanStackでは再現せず、取消後も復旧値と別のpending更新が残ることを確認した。helper関連52ケース・実useCurrencies 49ケースが成功した。外部の確定データ置換と同じgroupに参加する楽観更新が対象で、任意の外部writerのJSON差分やサーバー書込み同士の競合解決には保証を広げない。

再レビューで追加されたSession一覧の指摘にも対応し、create/edit/deleteを同じ更新groupへ移行した。ページ取得中の失敗、createとeditの並行完了、仮行の識別子保持、filter変更後の再取得先について、旧実装で追加6ケースが期待値の不一致により失敗することを確認した。確定応答とrefetchの両到着順を制御し、確定IDの行が別ページに存在する場合もサーバー行を優先して重複を解消する。共通helperの置換処理4ケースと後続ページ1ケースも補完した。詳細と既存挙動の維持範囲は [Webレビュー追補](testing-web-review.ja.md#session一覧のレビュー追補) に記録する。

同じ再取得先の問題はcurrency取引の3操作にもあったため、通貨切替中の完了を再現する3ケースをred確認してから修正した。切替元のcacheをstaleにし、切替先への不要なrefetchと表示変更を防ぐ。この段階のscoped実行はhelper関連56ケース、実useSessions 72ケース、実useCurrencies 52ケースの計180ケースが成功した。型・lint・規約検査とHEAD `acabf961` の [CI全体](https://github.com/HIRO15254/sapphire2/actions/runs/33949395689) も成功した。

続くレビューでは、sessionのfilter間で同じレコードが重複して該当することを踏まえ、完了時に一覧procedureのprefixを無効化するよう修正した。楽観表示とrollbackは開始時のqueryに限定するが、書込みの影響は表示中の別filterにも及び得る。追加済みの「切替先をrefetchしない」という期待値はsessionでは誤った契約だったため撤回し、表示中の一覧への作成・編集・削除の反映と、失敗時の開始側だけのrollbackへ置き換えた。3成功ケースと修正した失敗ケースは、変更前の期待値不一致を確認した。通貨取引の切替先は別通貨に所属するため、そちらの限定的な再取得は維持する。

Session作成を呼ぶpage hookの拒否handlerも補い、実画面・Wizard・QueryClient・tRPC HTTPを通す1シナリオを追加した。変更前は入力保持などのassertionが通っても、実際の `Unhandled Rejection` 1件によりVitestが失敗した。変更後はエラー表示、金額・メモ・roomとシートの保持、再試行成功時の閉鎖が未処理エラーなしで成功した。API認可やDB保存の検証とは区別する。Session hook 76ケース、既存page hookと新UIの49ケースが成功し、型・lint・規約と393ファイルの検出照合も成功した。別filterのpending更新をprefix refetch中も保持し、失敗直後に新しいサーバー基準へ戻す保護も含む。

その後、tRPCのキーを単純な配列で模倣するmockが、本番のquery種別の違いを消していたことが判明した。実options proxyとTanStackで確認すると、`session.list.queryKey()` は `type: "query"` を含み、`type: "infinite"` の一覧へ一致しなかった。`pathKey()` は入力条件の異なる3つの実cacheすべてに一致した。useSessionsのキー生成を実proxyへ置換したところ既存5ケースが失敗し、無効化を `pathKey()` に修正すると76ケースが成功した。

実画面テストも、成功後のシート閉鎖だけでなく、再取得したサーバー由来のroom名・保存IDのリンク・損益が一覧へ表示されることまで補強した。旧キーでは一覧表示が現れず失敗し、修正後は成功した。楽観行のID置換だけでは通らない検証であり、mockの期待値と呼出しが一致するだけの確認から保護範囲を広げている。

同じ不一致はセッション詳細・タグ・ライブ関連の既存10ファイルにもあったため、記録済みsession.listへの無効化キーだけを統一した。別procedureの通常queryは変更していない。既存13ケースを実infinite cacheの検証へ補強し、変更前の失敗を確認してから修正した。新しいテストケースを増やさず、関連11ファイル・122ケースが成功した。useSessions 76ケースと実UI 1ケースを合わせた今回の関連検証は199ケース成功。既存のassign-tournament失敗2ケースにあるact環境の警告は残るが、未処理エラーや新しい抑制設定はない。

英語ルールに通常queryとinfiniteのキーの区別を記録し、`check:rules` はproductionの `session.list.queryKey()` / `queryOptions()` を拒否する。既知の誤コードを一時的に置いて検出を確認し、除去後に正常へ戻した。キーの共通fixtureは `apps/web/src/__tests__/trpc-keys.ts` に置き、実options proxyを再利用する。
