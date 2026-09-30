**sapphire2 テスト方針・既存テスト再編計画**

2026-09-05 / 初期調査対象 HEAD: `37371fd8` / 承認後の実装・全面レビュー・CI検証を完了。確定した処置と検証結果は [実施記録](testing-refactor-results.ja.md) を参照する。

以下の現状・件数・問題例は開始時点の調査記録。現在のコマンドは [testing-environment.ja.md](testing-environment.ja.md)、各ファイルの移行判断はWeb・live・backendのレビュー記録を参照する。

推奨する変更は、**仕様と障害リスクに応じてテストを配置し、重要な検証を補ったうえで、宣言の写し・重複・実装構造だけを固定するテストを大幅に整理する**こと。削除率や総テスト数は目標にしない。既存テストの削除と不足分の追加は、同じ仕様を守る単位で進める。

**調査で確認した現状**

`rg --files` による棚卸しでは、テストは407ファイル、約10.2万行。ヘルパー・設定ファイルは行数に含まない。パラメーター化されたテストを展開していないため、これは実行ケース数ではない。

| 現行プロジェクト | ファイル数 | 実行環境 |
|---|---:|---|
| web-dom | 277 | jsdom |
| web-node | 40 | Node |
| api | 45 | Node |
| db | 32 | Node。うち7ファイルにBun専用の条件付き実行あり |
| server | 5 | Node |
| mcp | 6 | Node |
| env | 2 | Node |

設定のinclude/excludeをBun.Globで静的照合した範囲では、未割り当て・二重割り当てはともに0件。Vitest自身の `list --filesOnly --json` は、この環境でesbuildの子プロセス起動が `spawn EPERM` となり完了しなかった。全テスト実行・カバレッジ測定・実行時間測定はしていない。以下は代表テストと実装の静的監査であり、全407ファイルの削除可否を確定したものではない。

現行ルールの問題は、[AGENTS.md](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/AGENTS.md:88) が、全変更へのTDD、全分岐への個別 `it()`、全種類の境界値、全副作用への回数・引数検証を一律要求していること。小さな配線変更にもテスト追加を促す一方、認証・実SQL・競合を本当に検証できているかは保証しない。

具体例は次のとおり。削除候補という判定は、ファイル全体の無条件削除を意味しない。

| 対象と確認事項 | 変更方針 |
|---|---|
| [player-list-card-skeleton.test.tsx](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/features/players/pages/players-page/player-list-card/__tests__/player-list-card-skeleton.test.tsx:6) はCSSクラス・プレースホルダー数を固定 | 装飾構造のassertを削除。必要なロード中表示やアクセシビリティ契約をページ側で保護 |
| [players-page.test.tsx](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/features/players/pages/players-page/__tests__/players-page.test.tsx:11) はページhook・子要素をmockし、stubへのpropsを確認 | 実ページ・実hook・実フォームを組み合わせ、検索・保存成功・保存失敗の利用者操作へ集約 |
| [use-currencies.test.ts](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts:914) の「concurrent edits」は先の更新をawaitしてから次を開始 | deferred Promiseで2件を同時pendingにする。成功・失敗の順序が変わるケースを実際に作る |
| [同rollbackテスト](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts:865) は、再取得も復元後と同じ値を返す | 再取得を保留し、失敗直後・再取得前の復旧をassert。再取得がrollback欠落を隠さないようにする |
| `tournament-lifecycle.test.tsx` のreopenテストは最初から「activeSessionなし」をmock | 空状態へ統合する。実D1ではcashの開始→記録→完了→新callerで読戻し→再開、tournamentの完了→再開拒否・保存状態不変を補う。トーナメント終了後の再開は禁止する既存仕様だったため、初期計画の再開成功という想定を訂正 |
| [expectProtected](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/api/src/__tests__/test-utils.ts:73) はmiddleware数だけで認証を判定 | 未認証callerを実行し拒否されることを検証。更新系はDBが変わらないことも確認 |
| [DB mock](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/api/src/__tests__/test-utils.ts:263) はWHERE評価が既定off、JOIN/orderByがno-op、batchがPromise.all | 認可・絞り込み・ページング・原子性の保証を、実D1 binding上のcaller統合テストへ移す |
| [currency.test.ts](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/api/src/__tests__/currency.test.ts:10) などがprocedure存在・一覧・query/mutation型を反復 | 公開契約の集中チェックと実CRUD検証に集約。同一共有schemaの入力ケースも一か所にまとめる |
| [session-schema.test.ts](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/db/src/__tests__/session-schema.test.ts:9) が列名・FK個数・index名を反復 | 宣言を写したassertを削減。UNIQUE・FK・cascade・migration互換性は実SQLで保護してから置換 |
| [format-number.test.ts](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/utils/__tests__/format-number.test.ts:30) に同一入出力の重複と `InfinityB` の現状固定がある | 完全重複を削除。非有限値は入力契約と責務を確認して期待動作を決める。UTC日付の既知回帰は残す |

既存の防御は相当量ある。[MCP coupling](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/mcp/src/tools/__tests__/coupling.test.ts:38) のschema同一性・全procedureの公開／除外確認、[全migration履歴](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/db/src/__tests__/migration-0041.test.ts:565)、[seed復元](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/db/src/__tests__/preview-seed-restore.test.ts:163)、[楽観的更新の復旧](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/features/live-sessions/utils/__tests__/optimistic-session-event.test.ts:1260)、[損益計算](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/api/src/__tests__/live-session-pl.test.ts:484) は保全対象。長さやmockの有無だけでは削除しない。

**一次資料から採用する原則**

Googleは、カバレッジを未検証領域の発見に使いつつ、100%への一律追求が低価値テストの保守負債になり得ると説明している。低カバレッジの放置も推奨していない。このプロジェクトでは、全体の固定閾値に代えて、重要な未検証シナリオをレビューする。[Code Coverage Best Practices](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)

Testing Libraryは、コンポーネントの分割に合わせた網羅より、実際の操作を再現できる範囲での検証を勧める。したがって、hookへロジックを分離する設計規約と、すべてのhookに単体テストを作る要求は切り離す。[React Testing Library FAQ](https://testing-library.com/docs/react-testing-library/faq/#what-level-of-a-component-tree-should-i-test-children-parents-or-both)

AI固有のリスクは、実装とテストが同じ誤りを正解と見なすこと。2026年のISSTA採択論文では、バグ入りコードから生成すると誤動作を肯定するテストが増え、仕様を介した生成で改善した。Java・特定ベンチマークの結果であり、全モデル・このアプリへの効果量は断定しない。期待値を要求・不変条件・既知障害から導く根拠として採用する。[Evaluating and Mitigating the Misguidance Effect of Buggy Code in LLM-Generated Unit Tests](https://arxiv.org/abs/2607.22883)

Anthropicも、実行できる検証基準、バグ再現テスト、別の視点からのレビューを推奨する。本計画では、重要な期待値とテスト削除を実装担当とは別の観点で確認する運用に落とし込む。別エージェントも誤り得るため、レビューの独立性だけで正しさを保証したことにはしない。[Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)

Cloudflare公式はWorkers runtime内のVitestと、Worker全体を動かす統合harnessを補完的に案内している。現行NodeテストとBun SQLiteのmigrationテストを維持し、実D1 binding・HTTP接続にしか検出できない不具合を追加する。[Workers Testing](https://developers.cloudflare.com/workers/testing/)

これらから導く具体的な構成・優先順位は、このリポジトリに対する設計判断である。単体・統合・E2Eの件数比率に普遍的な正解があるとは扱わない。

**更新するルールの内容**

| 現行要求 | 新しい要求 |
|---|---|
| 全コード変更で新しいテストを先に書く | 振る舞いの追加・変更・バグ修正では期待動作を先に定義する。バグ修正は原則として再現テストのred→greenを記録。動作不変のリファクタリングは既存テストを安全網にし、不足する場合だけcharacterization testを補う |
| 全分岐に個別 `it()` | 業務上異なる結果・重要な失敗・認可・整合性を検証。分岐数とテスト数を一致させない |
| null/undefined/NaN/Infinity等を全関数で列挙 | 公開入力契約・到達可能性・同値クラスに応じて境界を選ぶ。外部入力の型検査をTypeScriptで代替しない |
| 全副作用で回数・順序・引数をassert | 結果を優先し、回数・順序が仕様の場合に限って厳密に検証。二重保存防止やキャッシュ消去順序などは対象 |
| 各hook・componentに同じ粒度のテスト | 独立したロジックはunit/hook、フォーム・画面の連携は利用者操作、認可・SQLはcaller＋DB、ブラウザー境界は少数E2E |
| 既存の網羅テストを無条件の雛形にする | 新方針で検証済みの代表例だけを参照。fixture/setupの共通化は反復が現れてから行い、テストの期待値や筋書きは読み取れる状態にする |

`AGENTS.md` のTesting節を短縮し、適用判断・AI向け禁止事項・コマンドの要点を置く。詳細は新設予定の `.claude/rules/testing.md` に移し、実装時にも読まれるよう `apps/**`・`packages/**`・`scripts/**` を対象にする。AGENTSの索引にも追加し、200行以内を維持する。`CLAUDE.md` はAGENTSへのimportを維持する。

AGENTSに置くルールの文案は以下。

> テストは変更される契約と障害リスクを保護する。新しいファイル・分岐ができたことだけを理由に追加しない。テスト設計・変更前に `.claude/rules/testing.md` を読む。
>
> 振る舞いの変更は期待結果を先に決める。バグ修正では不具合を再現し、意図した理由で失敗することを確認してから修正する。動作不変の変更では既存の検証を使い、無意味なredを作らない。文言・装飾・型だけの変更は、対応する静的検査や視覚確認で十分ならテスト追加不要。
>
> 期待値を実装の出力や実装の複製から作らない。要求・契約・不変条件・既知障害を根拠にする。現在の動作を記録するcharacterization testは、その目的を明記する。
>
> 同じ契約は主に一つの適切な層で守る。高リスクの境界には補完的な統合検証を加える。ロジックはhookに置く設計規約を、全hookへの個別テスト要求として解釈しない。
>
> 全分岐・全境界値・全呼出回数を一律義務にしない。意味のある正常・異常・境界を選ぶ。重要な認証・認可・金額・永続化・競合のケースは省略しない。
>
> 実装を通すためだけの期待値更新、skip追加、検出対象の除外、assertion弱体化をしない。テストの修正・削除が必要な場合は、契約の変更または代替する検証を説明する。
>
> 作業中は対象プロジェクトのテストを実行する。PRでは静的検査、CIの全Vitest、Bun migration、追加した重要統合フローを確認する。実行できなかった検証は明記する。

詳細ルールには、テスト追加の判断表、mock境界、削除判定、非同期処理の検証方法、代表例を含める。TDDのredは型エラー・import失敗ではなく、期待動作が未実装／誤実装であることを示すものにする。既存仕様がすでに実装済みの追加テストは、無理に本体を変更してredを作らず、必要なら一時的な意図的故障で検出能力を確認する。

静的ルールの重複実装は避ける。VitestにはCIでfocused testを拒否する既定動作がある。Bun専用テストのCI登録漏れは既存 `check:rules` が検出する。新しい機械検査は、既存のlint・型検査・runnerで守られていない事項に限る。「意味のないテスト」の判定は正規表現で自動削除しない。

**目指すテスト構成と優先追加シナリオ**

| 層 | 主に保護する契約 | 実体・mockの方針 |
|---|---|---|
| 型・lint・check:rules | 型整合、禁止API、設計上の制約 | テストで同じことを反復しない |
| Node unit / hook | 損益、UTC日付、変換、入力schema、局所状態機械 | 対象ロジックは実体。時刻・乱数・通信など必要な境界を制御 |
| UI integration | 入力→検証→送信→表示、失敗時の入力保持、キャッシュ更新 | 実hook・QueryClient・フォーム・子要素。通信境界をstub／MSW等で制御 |
| API integration | 認証、所有権、実SQL、永続化、原子性 | 実caller・実schema・Drizzle・ローカルD1 binding。LLM等の外部通信はfixture |
| Migration | 全履歴、既存データ変換、中断再開、UNIQUE/FK/trigger | 既存Bun SQLite実行を継続。D1固有差分だけ補完 |
| HTTP/MCP・ブラウザーE2E | Cookie/token、routing、serialization、永続キャッシュ、主要操作の接続 | テスト用Worker＋ローカルDB。少数の代表フロー。外部IdP/LLMの可用性に依存させない |

最優先の追加・置換は次の6群。

1. **認証・アカウント隔離**：未認証、他人のID・入力FK・bulk内の他人ID・間接所有権・cursorを検証。本人の正常系も対にする。応答だけでなく、他人の行が返らない／更新されないことを実DBでassertする。procedureごとに入力を用意し、認証前にvalidationが失敗しただけのケースを認証テストに数えない。
2. **D1の整合性**：関連行の置換処理を途中の制約違反で失敗させ、親・子・台帳が変更前と同じであることを検証。live sessionの同時作成・イベント順序の競合は、既存のunique違反変換テストに加え、並行要求後の永続状態を確認する。bulkの境界は既存chunk helperの実バインド数から算出する。
3. **楽観的更新と競合**：2件を同時pendingにし、同一／別対象、成功／失敗、必要な応答順序を選ぶ。古いpolling応答、再取得前のrollback、一覧と詳細の整合、後続ページの保持を確認。全組合せの機械的直積は作らない。
4. **永続キャッシュ**：[clearPersistedQueryCache](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/utils/trpc.ts:58) をmockするだけではなく、Aのデータ保存→logout→reload→Bで復元されないことを実persisterとブラウザーのIndexedDBで検証。既存のlogout順序・例外検証は補完として残す。
5. **主要フロー**：実認証・キャッシュ隔離・保存後reloadはブラウザー、cashの開始→記録→完了→新caller→再開とtournamentの完了→再開拒否は実D1で検証する。UIの入力・完了フォームは実UIでも補完し、永続化後の状態をassertする。UIの一覧だけをmockで返すテストをE2Eとは数えない。
6. **HTTPとMCPの接続**：有効tokenで本人データだけ取得、無効／期限切れtoken・削除済userの拒否、HTTPとMCPで同じ所有権規則になることを検証。MCP catalogue/couplingは残し、単純なpass-throughの全ケース二重化は避ける。

金額・日時・並べ替えにはproperty-based testingを限定的に試す。例えば「他ユーザーのデータを追加しても本人集計は変わらない」「同じUTC日付は表示環境のTZで変わらない」「並べ替え前後でID集合と件数が保たれる」。既知例・丸め誤差の契約と併用し、失敗seedと最小反例を保存する。[fast-check公式](https://fast-check.dev/docs/introduction/what-is-property-based-testing/)

mutation testingは本体へ小さな誤りを入れて、テストが検出するかを調べる補助手段。最初は純粋な重要ロジック2〜3領域で試す。生き残ったmutationを、意味のある見逃し・同値変異・到達不能などに分類し、スコア100%を目標にしない。StrykerのVitest runnerは候補だが、全Workersテストやブラウザーテストへの一括導入はしない。[Stryker Vitest Runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)

**実施順序とPRの分け方**

| 段階 | 作業・対象 | 完了条件 |
|---|---|---|
| 0. 基準記録 | 407ファイルを、守る契約・リスク・主な層・維持/統合/置換/削除・代替先で分類。全機能・公開API・主要ユーザーフローからも逆引きし、テストが存在しない領域を洗い出す。CIの既存結果から実行時間と失敗傾向を取得し、不足なら次のCIでreport artifactを保存 | 代表例に加え、削除対象すべてに理由がある。テスト件数と実行件数・skipの違いが説明でき、未テスト領域も判断対象になっている |
| 1. ルール更新 | AGENTS Testing節、`.claude/rules/testing.md`、参照例と索引、pre-PR/Stop/pre-commitの説明を整合 | 全分岐・全境界値等の義務が残らず、既存の保全義務が明確。旧Stop hookがfull suiteを実行するという古いpre-commitコメントも修正 |
| 2. 統合基盤と小さな縦断例 | D1で実migration→fixture→caller→DB読戻しを一本成立させる。playersの実UIフロー、Playwrightからの実ログインとAPI呼出し、レポート保存も成立させる。共通fixtureは最小限 | Windows/BunとLinux CIで実行可能。テスト状態が分離され、外部サービス不要。型・lint・既存対象テストに影響しない |
| 3A. Backendの置換 | 認証・認可→atomicity→JOIN/cursor/bulkの順。共有DB mockを使う重要シナリオを移植してから、対応する宣言/呼出しassertを整理 | 未認証拒否・他人のデータ隔離・失敗時DB無変更を確認。既存SA2回帰・MCP coupling・migration保護を維持 |
| 3B. Webの置換 | currenciesの競合/rollback→players等のページ配線→フォーム→skeleton/重複formatterの順 | 利用者操作と失敗時状態を守り、mockした返り値を見るだけのassertが減る。3Aと独立に並行可 |
| 4. 接続と残りの整理 | 少数ブラウザーE2E、HTTP/MCP認証、キャッシュ隔離を追加。DB metadata・共有schemaの重複を精査。限定property/mutationを試す | 主要フローがCIで動き、残りの全テストに維持理由または処置がある |
| 5. 定着 | 新しい代表テストへの参照を確定。利用されなくなったmock/helperを削除。計測結果でCI構成と時間予算を調整 | 新方針で変更を一巡でき、重要シナリオの検出力を保ちながら冗長な保守が減ったことを確認 |

段階はPR一件ずつと固定しない。3A/3Bは機能単位に分け、各PR内で「代替追加→検証→旧テスト削除」を完結させる。大規模な削除専用PRを先行させない。過去障害の回帰は、単に他テストと同じ行を通るという理由では削除しない。代替テストが同じ障害を検出できることを確認する。

削除理由の記録例は「旧テストAが守る契約 → 新テストB／既存の検査 → 残るリスク」。製品契約を持たない装飾構造・完全重複なら、その理由だけでよい。削除に合わせて未確認の挙動を正規化・修正する場合は、動作不変のリファクタリングと混在させず、仕様変更／バグ修正として期待値を別途説明する。

**統合基盤の選定と互換性**

現行の導入済みVitestは4.1.2、Wranglerは4.80.0。WebのVite指定は `^8.0.5` だが、今回のroot Vitest起動ログではVite 6.4.1が解決されており、実際の依存解決も確認が必要。2026年8月のCloudflare公式は `@cloudflare/vitest-plugin` とWranglerの `createTestHarness()` を案内している。古い `@cloudflare/vitest-pool-workers` を前提に決め打ちしない。[Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)、[Integration test harness](https://developers.cloudflare.com/workers/testing/test-harness/)

段階2では、現在のlockfileと互換性がある最小構成を試し、必要な依存更新を明示する。Workers内からの直接callerテストを優先し、HTTP/MCP・E2EはWorker全体のharnessを使う。新APIに必要な更新が大きければ、既存バージョンと適合するローカルMiniflare/D1経由の方式を比較する。テスト基盤の都合だけで全体をdowngradeしたり、独自SQL interpreterをさらに拡張したりしない。ローカルD1は本番の分散動作まで保証するものではないため、既知の本番差分は別途扱う。

**実行・完了判定**

ローカルの反復は現行どおり `bunx vitest run --project <対象> <path>` を使う。Bun専用migrationを変更した場合は対応する `bun test <path>` も実行する。新統合プロジェクトをroot設定へ登録するか専用scriptにするかは、段階2で確定し、どちらもCIから確実に呼ぶ。

CIでは既存の型・lint・check:rules・全Vitest・Bun migrationを維持し、重要integration/E2Eを追加する。`--changed` / `related` は通常の反復に使えるが、migration SQL、設定、動的参照は依存追跡から漏れ得るため、該当変更は明示的に対象を実行する。単なるテスト数減少を成功としない。

完了条件は以下。

- 重要な認証・認可・金額・永続化・競合・UTC日付のシナリオと、既知障害に対応する保護が残っている。
- 置換した重要テストが、代表的な意図的故障を検出する。例: owner条件除去、rollback除去、transaction外での部分更新。作業用の故障は検証後に戻す。
- 全既存テストについて維持・統合・置換・削除の判断が完了し、不要になったfixture/mock/helperも残らない。
- テスト検出漏れ・意図しないskipがなく、CIの全対象が成功する。現在のBun専用skipは専用runnerによる実行とセットで扱う。
- 固定時間待ちに頼らず、時刻・乱数・非同期完了・DB状態を制御できる。不安定な再実行成功で失敗を隠さない。
- 対象テストの反復時間、CI全体時間、失敗の再現性、テスト保守差分を基準と比較する。初期段階で根拠のない削除率・速度改善率・カバレッジ目標を設定しない。

最初に着手する範囲は、ルール更新と、API認証の実行検証・currenciesの真の競合テスト・playersの実UIフローを使った小規模な置換。ここで新しい雛形と削除判断が成立したことを確認し、同じ判断基準で残りを大きく再編する。

**追補: 全面リファクタリングを完了するためのテスト環境**

代表例の改善は移行の起点であり、プロジェクトの完了ではない。全既存テストと未テスト領域の判断、新しい基盤への必要な移植、旧mock/helperの整理、CIでの継続実行までを対象にする。特に以下の環境を段階2で用意すると、その後の大規模な置換を進めやすい。

| 優先度 | 追加・整備する基盤 | 導入完了の確認 |
|---|---|---|
| 必須 | Workers＋ローカルD1の統合テスト。実migration、ユーザーA/B・関連行のfixture、ケース間のDB初期化 | 実callerで保存したデータを読戻せる。他人の行は取得・変更できず、途中失敗後もDB状態が正しい |
| 必須 | 実Better Authの認証fixtureとHTTP/MCPテストURL | Cookieでのログイン・session読戻しと、有効tokenでのMCP呼出しが実DBまで到達する |
| 必須 | Vitest/jsdom＋実Router・QueryClient・フォーム＋MSWによるUI統合テスト | tRPC HTTP通信の成功・拒否・遅延を制御し、利用者操作から表示変化まで検証できる |
| 必須 | Playwright＋ビルドしたWeb＋テスト用Workerの自動起動・停止 | 実ログイン、画面操作、保存後reload、同じブラウザーでのアカウント切替をローカルとCIで再現できる |
| 必須 | 時刻・TZ・乱数・応答順序・外部API応答を制御する共通fixture | 同時pending、逆順応答、日付境界、LLMの不正応答等を固定sleepなしで再現できる |
| 必須 | 実行環境の固定、テスト検出確認、機械可読レポート、失敗時trace | 同じ依存・同じ手順で再実行でき、失敗箇所・再現コマンド・実行されなかったテストを人とAIが確認できる |
| 次段階 | 限定したfast-check、Stryker、axe-core、スクリーンショット比較 | 対象の不変条件・見逃し・アクセシビリティ・重要なレイアウトだけを補完し、用途が重ならない |

D1のfixtureは、本番schemaを手書きで再現せず、リポジトリのmigrationを適用して作る。migration適用の重い準備は共有可能だが、各ケースのデータは初期化する。現行のCloudflare Vitest pluginのストレージ隔離はファイル単位なので、同一ファイル内の各 `it()` が自動的に隔離されると仮定しない。テスト用binding・一時ストレージは開発用DBと分離する。[Cloudflare: Isolation and concurrency](https://developers.cloudflare.com/workers/testing/vitest-integration/isolation-and-concurrency/)

認証fixtureには、テスト用ユーザーを実Better Authで登録・ログインさせ、通常テストで利用するCookie/tokenを準備する経路を設ける。認証そのものを検証するケースは、その準備でログイン操作を省略しない。MCPでは少なくとも一つ、OAuthクライアント登録→PKCE・同意→token取得→tool実行を通すケースを持つ。更新系は並列workerごとにアカウントを分け、同一worker内でもケースごとに関連データを初期化する。logout後の情報漏れテストは、AとBの間でブラウザーcontextを交換せず、同じcontextで実際にlogout→reload→Bのloginを通す。[Playwright: Authentication](https://playwright.dev/docs/auth)

[認証設定](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/packages/auth/src/index.ts:219) は `SameSite=None`・`Secure` を使用する。テストURLは本番のorigin/site関係とCookie属性を検証できるよう設計し、HTTPSで動かせる構成を最初の互換性確認に含める。テストを通すためだけにCookie属性やCORS認証を弱めない。実HTTP/MCPの成功経路ではsessionやcaller全体のfakeを使わず、外部IdP等だけを境界で制御する。

MSWは主にjsdomのUI統合で使い、実tRPC clientのHTTP batch形式を通す。未定義のアプリ通信は失敗として扱い、ケースごとのhandlerを復元する。fixtureはAPIの公開契約に合わせ、tRPC内部形式を多数のテストへ手書きコピーしない。実バックエンドとの接続は別のHTTP/E2Eテストが保護する。[MSW: Node.js integration](https://mswjs.io/docs/integrations/node)

Playwrightは最初にChromiumのdesktop/mobile表示で主要フローを動かし、対応ブラウザーに応じてWebKit等へ必要なフローだけ広げる。起動・準備完了待ち・終了・テスト専用ポートをharnessにまとめる。[Playwright: Web server](https://playwright.dev/docs/test-webserver)

このアプリは [Vite設定](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/vite.config.ts:24) で開発時のPWAを無効にしているため、PWAの検証にはbuild後の配信環境が必要。通常の画面操作と、Service Workerを有効にしたキャッシュ・更新・オフライン復帰のケースを明示的に分ける。IndexedDBの永続化は実ブラウザーで検証する。Service Worker経由の通信は通常のページ通信と扱いが異なるため、MSWやroute interceptionとの干渉も確認する。[Playwright: Service Workers](https://playwright.dev/docs/service-workers)

環境の再現性では、現在のCIの `bun-version: latest` を見直し、packageManagerと同じBun、依存と適合するNode、Playwrightブラウザーのバージョンをローカル・CIで揃える。Windowsでのコマンドとプロセス終了も検証する。外部LLM・地図APIの応答は記録済みfixtureで制御する。また、[GitHub Releasesを取得するVite plugin](C:/Users/PC_User/.codex/worktrees/57fc/sapphire2/apps/web/src/plugins/vite-plugin-github-releases.ts:24) がbuild時の外部依存になるため、テストbuild用に安定したrelease fixtureを注入する経路も必要。初回の依存取得後は、テストの成否が外部サービスの応答に左右されない構成にする。

カバレッジはNode/jsdomから導入し、実装ファイルを明示した `coverage.include` で未importのファイルも表示する。全体閾値を設けなくても、未テストの機能を棚卸しするために必要になる。Workers側の計測方式は採用pluginとの互換性確認後に選び、未計測の範囲を全体カバレッジへ混ぜない。[Vitest: Coverage](https://vitest.dev/guide/coverage)

CIは静的検査、Vitest、Bun migration、Workers統合、Playwrightを必要に応じて別jobにし、失敗時も結果artifactを残す。JUnit/JSON、実行時間、skip理由、Playwright trace・画面・ブラウザーエラー・Workerログを保存する。再試行後に成功したケースも不安定なテストとして識別する。新しいコマンド群は、現在の対象プロジェクト実行を維持しつつ、統合・E2E・coverageを同じ入口から呼べる程度の小さな構成にする。[Playwright: Trace viewer](https://playwright.dev/docs/trace-viewer-intro)

axe-coreとスクリーンショット比較は、Drawer・フォーム・キーボード操作など重要UIの補完に使う。自動アクセシビリティ検査だけで操作性を保証しない。画像比較はOS・フォント・時刻等を固定した代表画面に限定する。[Playwright: Accessibility testing](https://playwright.dev/docs/accessibility-testing)

全面移行の完了判定には、初回セットアップ後の単一手順で「初期化→起動→実行→結果保存→終了」が成立すること、並列実行でもデータが混ざらないこと、重要な失敗を意図的に起こせること、全機能と全既存テストの移行判断が完了していることを加える。テスト基盤の導入と数件の見本だけでは、このプロジェクトを完了としない。
