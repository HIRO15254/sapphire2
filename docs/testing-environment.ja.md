# テスト実行ガイド

テストの追加・削除・mock境界の規則は [testing.md](../.claude/rules/testing.md)、runner・D1選定理由・fixture・CI・計測限界は [Testing and Tooling](design/testing-and-tooling.md) に集約する。この文書は人が実行するときの入口と診断手順を扱う。

## 初回セットアップ

リポジトリ直下で実行する。Bunは [package.json](../package.json) の `packageManager`、Nodeは `.node-version` の版を使う（最低版は `engines.node`。migrationの `node:sqlite` に必要）。

```sh
bun install --frozen-lockfile
bunx playwright install chromium
```

LinuxでブラウザーのOS依存も入れる場合は、後者を `bunx playwright install --with-deps chromium` に置き換える。本番認証情報・本番DB・外部サービスへの接続は不要。

## 実行コマンド

| 目的 | コマンド |
|---|---|
| 全Vitest（D1統合を含む） | `bun run test` |
| Vitest watch | `bun run test:watch` |
| D1統合を除く全Vitest | `bun run test:unit` |
| 純粋関数・Web schema | `bunx vitest run --project web-node <path>` |
| hook・component・UI統合 | `bunx vitest run --project web-dom <path>` |
| API単体 | `bunx vitest run --project api <path>` |
| DB・migration | `bunx vitest run --project db <path>` |
| Server / MCP / Env | `bunx vitest run --project <server-or-mcp-or-env> <path>` |
| script / テスト基盤helper | `bunx vitest run --project <scripts-or-testing> <path>` |
| 全D1統合 | `bun run test:integration` |
| 特定のD1統合 | `bunx vitest run --project api-integration <path>` |
| 全ブラウザー・HTTP | `bun run test:e2e` |
| モバイル保存・キャッシュ | `bun run test:e2e e2e/persistence.spec.ts --project mobile` |
| OAuth/MCP | `bun run test:e2e e2e/oauth-mcp.spec.ts --project desktop` |
| パスキー | `bun run test:e2e e2e/passkeys.spec.ts --project mobile` |
| 未検出・重複割当 | `bun run check:test-discovery` |
| 全workspace・script・基盤・E2Eの型（テストを含む） | `bun run check-types` |
| lint / 規約 | `bun run lint` / `bun run check:rules` |
| Node/jsdomカバレッジ | `bun run test:coverage` |

`<path>` は対象ファイルまたはディレクトリで置き換える。`<server-or-mcp-or-env>` と `<scripts-or-testing>` は一つの実project名を選ぶ。migration専用のBun runnerは不要。実行対象・レポートの定義は [package.json](../package.json)、[vitest.config.ts](../vitest.config.ts)、[playwright.config.ts](../playwright.config.ts)、[checks.yml](../.github/workflows/checks.yml) を参照する。

## 参照するfixtureと設計

- D1 caller統合: [test-fixture.ts](../packages/api/src/__integration__/test-fixture.ts) の `test`。
- 実HTTP・アカウント登録: [e2e/fixtures.ts](../e2e/fixtures.ts)。
- Web QueryClient: [test-utils.tsx](../apps/web/src/__tests__/test-utils.tsx)。
- 実tRPCキーとrollback・並行更新: [Testing and ToolingのWeb節](design/testing-and-tooling.md#web-test-gotchas)。
- 画面統合harnessの再導入元と現在の制限: [同文書のtrpc/env節](design/testing-and-tooling.md#the-trpcenv-stub-pattern)。
- パスキーの仮想認証器と検証限界: [同文書のHTTP境界](design/testing-and-tooling.md#isolation-and-http-boundaries) と [passkeys.spec.ts](../e2e/passkeys.spec.ts)。

## 失敗を調べる

- E2Eの専用ポート `13001` / `18787` が使用中なら、同じworktreeの別実行が終わってから実行する。開発サーバーへの接続で代用しない。
- ブラウザー結果は `test-results/` と `playwright-report/`。失敗時trace・画面・error-context、起動ログ `test-results/worker.log` を調べる。`bunx playwright show-trace <trace.zip>` で操作と通信を追える。
- カバレッジHTMLは `coverage/`。Worker側まで測定された数値とは解釈しない（[計測範囲](design/testing-and-tooling.md#discovery-ci-and-measurement)）。
- Node 22の `node:sqlite` の `ExperimentalWarning` は既知の通知（[migration harness](design/testing-and-tooling.md#nodesqlite-migration-tests)）。失敗とは分けて読む。
- OAuthの依存patchと更新時の回帰確認は [patches/README.md](../patches/README.md) を参照する。

検証結果の報告と故障注入の方針は [テスト規則](../.claude/rules/testing.md) を参照する。
