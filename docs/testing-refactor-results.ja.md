**テスト再編の実施記録**

2026-09-05 / 基準HEAD `37371fd84f2a6c5fd32e726d2793c3489f455ca3`。全407既存ファイルを対象に、維持・統合・置換・削除の判断と不足する検証を整理した。実行結果は最終CI確認後に確定する。

個別根拠は [Web 223ファイル](testing-web-review.ja.md)（主表222＋currency第一波1）、[live 90ファイル](testing-live-review.ja.md)、[backend 90ファイル](testing-backend-review.ja.md) と下表4ファイルを参照する。独立した機械照合で407件の欠落・重複・処置と実ファイルの不一致がないことを確認した。[初期分類](testing-migration-inventory.ja.md) のreview等は初期の候補ラベルであり、最終処置はこれらのレビュー記録に置く。

最新dev `8d3dbdc2` の統合で加わったパスキー・OAuth継続関連12ファイルも別枠でレビューした。各領域の追補に処置を記録し、開始時点の407件には混ぜない。認証機能とコメント整理を維持し、古いmock・rollbackの推奨が残っていた `docs/design/testing-and-tooling.md` も新方針へ整合した。

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

- 最新dev統合後の全9 Playwrightケース成功（30.5秒、再試行0）。未認証authorize→実ログイン→同意の継続と、実Cookie属性のassertを含む。
- Bun SQLite migration/seed復元は7ファイル・55ケース成功（0.73秒）。
- 全52migrationを適用する実D1統合は8ファイル・36ケース成功。最新devのpasskey保存・unique・cascadeを含む。
- Web広域の変更・代替先31ファイル371ケース、live領域87ファイル964ケース、API/MCP51ファイル1592ケースの関連実行が成功。これらは実行範囲が重なるため単純合算しない。
- 最新dev統合後はAPI/MCP/D1の59ファイル1,619ケース、live/auth/sharedの98ファイル1,114ケース、新Serverの3ファイル41ケース、新Settingsの3ファイル58ケースが成功。
- 型・追加基盤の型・lint・check:rules・Vitest検出照合（390ファイル、欠落・重複なし）は成功。最終CIの各jobを追加で確認する。

全体の速度改善率やcoverage向上率は、同条件の実行基準がないため主張しない。coverageはNode/jsdomのみで、workerdの別processを計測した数値ではない。実D1で全機能の全状態を網羅したとは扱わず、独立した純粋関数・状態・入力契約のunitも維持する。

Stryker全体実行、全面的な画像snapshot、別site間の第三者Cookie制限、実外部IdP、PWAの実デプロイ更新、本番D1の分散障害は今回の必須gateに含めない。PWA更新通知の操作は既存hookテスト、SWとキャッシュは実ブラウザーで役割を分けている。実行方法と依存patchの扱いは [環境ガイド](testing-environment.ja.md) を参照する。
