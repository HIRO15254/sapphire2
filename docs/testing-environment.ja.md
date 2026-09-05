**テストの実行と追加方法**

Bun 1.3.10、Node 22.19.0を使用する。初回はリポジトリ直下で `bun install --frozen-lockfile` と `bunx playwright install chromium` を実行する。Linuxでは `bunx playwright install --with-deps chromium` を使う。以降のテストに本番認証情報・本番DB・外部サービスへの接続は不要。

| 目的 | コマンド | 検証範囲 |
|---|---|---|
| 通常の反復 | `bunx vitest run --project <project> <path>` | `web-node` / `web-dom` / `api` / `db` / `server` / `mcp` / `env` |
| D1の契約 | `bun run test:integration` | 実migration・実D1・Drizzle・caller。ケースごとにDBを作成・破棄 |
| 実ブラウザー・HTTP | `bun run test:e2e` | build→HTTPS Worker/Web→全migration→Playwright→停止 |
| モバイル保存・キャッシュ | `bun run test:e2e e2e/players.spec.ts e2e/persistence.spec.ts --project mobile` | 実フォーム、reload、a11y、同contextでlogout→reload→別account、SW/IndexedDB |
| OAuth/MCP | `bun run test:e2e e2e/oauth-mcp.spec.ts --project desktop` | 実DCR・PKCE・同意・token・toolとCookie tRPCの読戻し |
| 未検出の確認 | `bun run check:test-discovery` | Vitest一覧と全specを照合。`test-results/discovery.json` |
| 新基盤の型 | `bun run check:testing-types` | Playwright・起動script・D1統合。Webは既存 `check-types` |
| カバレッジ | `bun run test:coverage` | Node/jsdom全対象。HTML/LCOV/JSONを `coverage/` に保存 |

反復は対象を絞る。SQL・runner設定・動的参照の変更は `--changed` だけに頼らない。CIは全単体、D1、Bun SQLite migration、ブラウザー、静的検査を別jobで実行し、最後の `ci` jobで全成功を要求する。

**追加する検証の置き場所**

方針の正本は [testing.md](../.claude/rules/testing.md)。期待値は要求・不変条件・既知障害から決める。runnerの除外やskipで失敗を隠さない。

- UI連携は実page/hook/QueryClient/フォームを使う。[integration.tsx](../apps/web/src/__tests__/integration.tsx) とplayers/currencies/roomsの `*.integration.test.tsx` を参照する。MSWは実tRPC clientの通信境界に置き、標準adapterでbatch形式を扱う。未定義通信は失敗させ、ケース間でhandlerと状態を戻す。
- SQLは [test-fixture.ts](../packages/api/src/__integration__/test-fixture.ts) の `test` を使う。sessionオブジェクトを渡すcaller統合と、実Cookie/token取得を通すHTTPテストを区別する。
- 認証・永続化は [fixtures.ts](../e2e/fixtures.ts) の実登録アカウントとログイン操作を使う。各ケースのユーザーを分ける。アカウント切替検証では同じcontextを維持し、本物のsign-outを実行する。
- passkeyの実登録・認証は [passkeys.spec.ts](../e2e/passkeys.spec.ts) を参照する。[Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession) から [CDP WebAuthn](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/) のCTAP2仮想認証器を作り、resident keyとuser verificationを有効にする。実Settingsで登録し、reload・logout・passkeyログインを通して同じaccountへの復帰と署名counterの増加を確認する。SDK・`navigator.credentials`・認証APIをmockせず、認証器はケース終了時に除去する。実機の生体認証やOSダイアログの見た目は対象に含めない。
- 競合は複数要求を同時pendingにする。currencyの更新列テストと `optimistic-query-updates.test.ts` を参照する。再取得を保留してrollback自体を確認する。
- fast-checkは損益グラフの入力順序と非破壊の不変条件に限定した。固定seed・実行回数を指定し、失敗時のseed/pathで再現する。例ベースの金額・UTC日付回帰も保持する。

**環境の境界**

[serve-e2e.ts](../testing/serve-e2e.ts) は本番entrypointとcompatibility設定をdry-runでbundleし、Miniflareで動かす。APIは `https://localhost:18787`、Webは `https://localhost:13001`。本番のSecure/SameSite/CORS設定は変更しない。ローカル自己署名証明書はテストブラウザーだけで許容する。Service Workerにも必要なためChromium起動引数を指定している。

ポート使用中なら失敗させ、既存の開発サーバーを再利用しない。Playwrightは1回の起動で2 workerを使う。別の `test:e2e` コマンドを同時に起動しない。各ケースは一意のユーザー、D1統合はケース専用DBで分離する。Windowsでも終了時にテスト用Worker/Webが停止する。

`.test-runtime/` はテスト用bundleのみ。D1の永続化先は設定せず、開発DBを再利用しない。Web buildの `mode=test` は固定release fixtureを使い、GitHubの応答に依存しない。Workerの外部fetchは未知の要求を502で拒否する。LLM・地図の分岐は既存unitの外部境界fixtureで検証する。

本番ビルドのService Workerと実IndexedDBでオフライン再読込・復帰を検証する。desktop幅では製品仕様どおりスマートフォンへの案内を確認し、フォーム操作はmobile projectで行う。

カバレッジは未importの実装も含むが、別processのworkerd内は計測しない。Node/jsdomの数値をWorker全体のカバレッジとは扱わない。実D1は独立した検証結果として読む。ローカルD1は本番の分散・運用障害まで保証しない。

**失敗を調べる**

HTTPSの別origin・同siteでCookie属性とCORSを確認している。別site間での第三者Cookie制限や実IdPログインは、このローカル環境の検証範囲に含まない。

結果は `test-results/` と `playwright-report/`。失敗時trace・画面・error-context、起動ログ `test-results/worker.log` を保存する。`bunx playwright show-trace <trace.zip>` で操作と通信を追える。再試行は0回。CIは失敗時もartifactを保存する。

Better Auth 1.6.0の同意拒否redirectが既存callback queryとOAuth stateを落とす不具合を、[Bun patch](../patches/better-auth@1.6.0.patch) で修正した。依存更新時はOAuth回帰を実行し、上流修正済みならpatchを削除する。

Strykerの全体実行や広範な画像snapshotは必須gateにしない。重要なrollback・DB原子性・認可は限定的な故障注入で検出力を確認し、axeでフォームを補完する。画像比較は維持する画面と基準環境を決めてから追加する。
