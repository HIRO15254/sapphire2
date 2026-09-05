---
paths:
  - "apps/**"
  - "packages/**"
  - "scripts/**"
  - "e2e/**"
  - "testing/**"
  - "patches/**"
  - "vitest*.ts"
  - "playwright*.ts"
  - "package.json"
  - ".github/workflows/**"
  - ".husky/**"
  - ".claude/settings.json"
---

# テスト設計と保守

全分岐・全境界値の一律網羅は、宣言やmockを確認するテストを増やす一方、実認証・SQL・競合の欠落を隠していた。テストの量ではなく、要求した動作と重要な障害を検出できることを優先する。

## 変更からテストを選ぶ

| 変更 | 必要な検証 |
|---|---|
| バグ修正 | 不具合を再現し、期待動作の不一致で失敗することを確認してから修正する。型／import／環境エラーはredの証拠にならない |
| 振る舞いの追加・変更 | 要求、成功条件、重要な失敗、意味のある入力境界を先に決め、その契約を最も直接検証できる層に置く |
| 動作不変のリファクタリング | 既存テストを使う。不足した契約だけ補う。実装を意図的に壊して形式的なredを作らない |
| 文言・装飾・型だけの変更 | 型・lint・視覚確認・既存テストで十分ならテスト追加不要。アクセシビリティや入力の意味が変わる場合は、その振る舞いを検証する |
| テストの統合・削除 | 守る契約、代替する検証、残るリスクを確認する。装飾構造の固定や完全重複なら、不要である理由を記録する |
| テスト基盤・設定・migration | 関連テストの実行に加え、対象がrunnerに検出されること、隔離、失敗時の終了・資料保存を確認する |

期待値の根拠は要求・公開契約・不変条件・既知障害に置く。AIが現在の実装出力をそのまま期待値にしたり、実装の計算式をテスト内に複製したりしない。意図が不明な既存動作を記録するときは、characterization testであることと未確定の仕様を明記する。重要な金額・認可の期待値と保護を減らす変更は、実装とは別の観点でレビューする。

正常系と、業務上異なる結果になる異常系・境界を選ぶ。すべての関数に `null` / `undefined` / `NaN` / `Infinity` を流す必要はない。外部入力の実行時検証、認証・所有権、金額計算、UTC日付境界、部分失敗、競合は到達可能なシナリオを省略しない。カバレッジは未検証領域を探す資料であり、全体100%や削除率を目標にしない。

## 検証する層とmock境界

| 層 | 主に保護するもの | 実体として動かすもの |
|---|---|---|
| 静的検査 | 型整合、禁止API、設計制約 | TypeScript、Ultracite、`scripts/check-rules.ts`。同じ制約をテストで重複させない |
| unit / hook | 計算、変換、入力schema、独立した状態遷移 | 対象の関数・hook。時刻・乱数・通信などの必要な境界を制御する |
| UI統合 | 入力→検証→送信→表示、失敗時の入力保持、キャッシュ更新 | 実component・hook・フォーム・QueryClient。通信境界で応答を制御する |
| API / DB統合 | 所有権、JOIN、絞り込み、ページング、永続化、原子性 | 実caller・schema・Drizzle・テスト専用D1。応答だけでなく保存状態を読戻す |
| migration | 全履歴、データ変換、UNIQUE/FK/cascade、復旧 | 実migrationとSQLite。Workers/D1固有の契約はD1で補完する |
| HTTP / MCP / E2E | Cookie/token、routing、serialization、再読込、アカウント切替 | 実認証・Worker・DB・必要なブラウザー機能。外部IdP/LLM等だけを境界で制御する |

同じ契約の全ケースを複数の層で繰り返さない。UIのhook分離は実装の設計規約であり、各hookとcomponentを個別にmockしてテストする義務ではない。独立した状態機械はhookで、画面の配線は実際の操作で検証する。

対象自体をmockしない。依存をmockするときは何を検証対象から外すのかを説明できるようにする。DB呼出しのmockは分岐の補助であり、SQLの認可・JOIN・原子性を保証しない。ミドルウェア数やprocedureの存在も認証拒否の証拠にならない。未認証・他人のID・本人の正常系を実行し、入力validationだけで失敗したケースを認証検証に数えない。

UIはrole・label・表示結果と利用者操作を優先する。CSSクラス、装飾要素の数、内部state、mockした子へのpropsだけを固定しない。例外はそれ自体が製品契約の場合に限る。副作用の回数・順序は二重保存防止やlogout時のキャッシュ消去など、それが契約の場合に検証する。

## 非同期・状態・外部依存

- 並行更新はdeferred Promise等で複数要求を実際にpendingにし、必要な成功／失敗／応答順序を作る。順番に `await` するケースを競合テストと呼ばない。
- rollbackは再取得を保留して、失敗直後の復旧を確認する。再取得結果が欠落したrollbackを隠さないようにする。
- 時刻・乱数・タイマーを制御し、完了条件を待つ。固定sleepで安定化しない。ケース間でhandler・mock・timer・DBデータを戻し、ファイル隔離をケース隔離と取り違えない。
- QueryClientはケースごとに作成してretryを制御する。ブラウザー永続化の隔離は実IndexedDBで確認し、logout→reload→別ユーザーの検証では同じブラウザーcontextを維持する。
- 外部ネットワークの可用性に依存させない。固定fixtureを使い、未知のアプリ通信は失敗させる。実HTTPの正常系で認証やcaller全体をfakeにしない。
- テスト用DB・binding・port・アカウントは開発用／本番用から分離する。並列workerとケースの状態を分離し、終了時に開放する。テストを通すためにCookieやCORSの製品設定を弱めない。

## 既存テストを減らす判断

削除や統合は「旧テストが守る契約 → 代替テスト／既存検査 → 残るリスク」をPRまたは移行記録に残す。代替が必要な場合は、追加と実行確認を先に済ませてから旧テストを削除する。製品契約を持たない装飾構造や完全重複は、その根拠を説明すれば代替の追加は不要。

長い、mockが多い、同じ行を通るという理由だけで削除しない。既知障害、損益計算、migration、楽観的更新の復旧、MCP couplingは対応する保護を保持する。重要な置換では旧障害の再現または限定的な意図的故障で検出力を確認し、作業用の故障は必ず戻す。mutationの全体スコア100%は要求しない。

テストの修正・skip・除外・assertionの緩和を実装の失敗を隠すために使わない。仕様変更なら期待値が変わる根拠を記録し、動作不変の整理と区別する。環境起因の未実行を成功に数えない。不要になったmock・fixture・helperは呼出元がなくなった時点で削除する。

## 配置・共有・実行

現在の起動手順・新しい代表例・計測範囲は [`docs/testing-environment.ja.md`](../../docs/testing-environment.ja.md) を参照する。`bun run check:test-discovery` が全specの未割り当て・二重割り当てを検査する。

unit / hook / componentテストは既存どおり `__tests__/foo.test.ts(x)` またはcomponentフォルダーの `foo.test.tsx` に置く。統合／E2Eは専用runnerの検出対象に登録する。配置を変えるときはinclude/excludeを確認し、未検出・意図しない二重実行を残さない。

既存共有ヘルパーは [`apps/web/src/__tests__/test-utils.tsx`](../../apps/web/src/__tests__/test-utils.tsx) のQueryClient作成等を再利用する。APIの `test-utils.ts` は必要なschema抽出やfixtureだけを使い、既存DB mockをSQLエミュレーターとして拡張しない。共有化は反復が現れたところで行い、期待値とシナリオを読めなくする汎用DSLを作らない。`vi.hoisted` はmodule mock間の共有状態に使用できる。フォーム連携では実 `@tanstack/react-form` を使用する。

| 対象 | ローカルの反復コマンド |
|---|---|
| 純粋関数・Web schema | `bunx vitest run --project web-node <path>` |
| hook・component・UI連携 | `bunx vitest run --project web-dom <path>` |
| API | `bunx vitest run --project api <path>` |
| 実D1・caller統合 | `bunx vitest run --project api-integration <path>`（全統合は `bun run test:integration`） |
| Server | `bunx vitest run --project server <path>` |
| DB | `bunx vitest run --project db <path>` |
| MCP | `bunx vitest run --project mcp <path>` |
| Env | `bunx vitest run --project env` |
| Bun SQLite migration | `bun test packages/db/src/__tests__/<対象>.test.ts` |
| ブラウザー・実HTTP | `bunx playwright test <path> --project <desktopまたはmobile>`（全E2Eは `bun run test:e2e`） |
| runnerの登録漏れ・重複 | `bun run check:test-discovery` |
| テスト基盤・E2E・D1 fixtureの型 | `bun run check:testing-types` |

ローカルでは関連範囲を実行する。`--changed` / `related` だけではSQL・設定・動的参照が漏れ得るため、該当変更では明示的に対象を指定する。新しい実行基盤はpackage scriptとCIの両方に登録してから完了とする。

Playwrightはテスト専用のHTTPS Web/WorkerとD1を起動する。同じ作業ディレクトリでは専用portを使う実行を重ねない。E2E fixtureの実アカウント登録とログインを再利用し、終了時のプロセス解放・失敗時のtrace/log保存を保つ。依存の局所パッチは `patches/README.md` に対象バージョン・根拠・回帰テスト・除去条件を記録し、`bun install --frozen-lockfile` で再現性を確認する。

PRでは `bun run lint`、`bun run check-types`、`bun run check:rules` と対象テストを確認する。CIが全Vitest、Bun migration、登録済みの重要統合／E2Eを実行する。未実行、skip、失敗、再試行でのみ成功したケースを区別して報告する。件数はファイル数・宣言数・パラメーター展開後の実行数を混同しない。

`.husky/pre-commit` はstaged関連のテスト、`.claude/settings.json` のStop hookは整形・`vitest run --changed HEAD`・lint・`check:rules` を実行する。どちらも全スイートの代替ではなく、全対象の最終検証はCIで行う。Bun SQLiteテストのCI登録漏れは既存 `scripts/check-rules.ts` で確認する。runner・型・lintにある検査を重複実装せず、「低価値テスト」を正規表現で自動削除しない。
