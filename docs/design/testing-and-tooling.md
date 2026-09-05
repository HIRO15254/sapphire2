# Testing and Tooling

テスト基盤の判断根拠を記録する。契約・リスクに応じたテスト設計は [`.claude/rules/testing.md`](../../.claude/rules/testing.md)、実行コマンド・CI・fixtureの保証範囲は [`testing-environment.ja.md`](../testing-environment.ja.md)、migrationの作成規約は [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md) を参照する。

pre-commitはstagedのコード変更をきっかけに `vitest run --changed HEAD` を実行する。大量変更の統合で `vitest related <全パス>` がWindowsの引数長上限を超えたため、Vitest自身にGitの変更一覧を取得させる。unstaged変更の関連テストも対象になり、staged専用の検証ではない。[Vitest CLI](https://vitest.dev/guide/cli.html#changed)

## The packages/api mock-db contract

[`packages/api/src/__tests__/test-utils.ts`](../../packages/api/src/__tests__/test-utils.ts) はschema検証と既存unit向けの共有helper。SQL・所有権・永続化・原子性の検証には [`test-fixture.ts`](../../packages/api/src/__integration__/test-fixture.ts) の実D1を使う。既存mockの機能をSQL interpreterとして拡張しない。

**`createChainableMockDb`** is a minimal chainable Drizzle-style mock `db` for exercising router procedures without a real database. Beyond resolving the rows configured per table, it records the bound params of every join and `where(...)` call on select/update/delete (`selectJoinParams`, `selectWhereParams` / `updateWhereParams` / `deleteWhereParams`) so **ownership scoping can be asserted** (SA2-176, SA2-183). Execution is **eager**, unlike a real DB: an insert is already recorded when `.values()` runs, and `db.batch([...])` just awaits already-resolved statements together (SA2-116).

**`evaluateWhere` is opt-in.** Enabling it makes `where(cond)` actually filter the configured rows through `cond` and `limit(n)` truncate them, so a procedure that pushes its whole predicate into SQL (rather than re-filtering rows in JS) can be exercised — the motivating consumer is `filter-preset.ts`'s `assertNameAvailable`, which does no JS re-filtering. Two deliberate constraints:

- **Only `and` / `or` / `eq` / `ne` are understood; any other operator throws** rather than silently matching, so an enabled mock can never quietly report a filter the query does not really apply.
- **Off by default** because fixtures written before this option assume `where(...)` is a no-op.

**The projection contract (c35).** A `select({ ... })` projection with a single-key aggregate (`{ maxSort: max(table.sortOrder) }`) collapses to one computed row like a real DB would. Every **other** select shape returns the configured rows unchanged — every existing fixture is written keyed by the query's **output** field names (including join projections that alias a joined table's column), so re-deriving keys from the Column reference would break that established convention.

**The mock-placeholder gotcha.** The mock's post-insert lookup does **not** filter by the freshly inserted id, so a create-path test whose procedure re-reads the row after inserting must seed a dummy pre-existing row for that table — otherwise the lookup resolves to nothing and the procedure's post-insert branch is silently never exercised.

## Seed tests: module replacement

A test that `vi.mock`s the seed-constants module gets its own file, because the mock is module-wide. The two dedicated specs exist precisely because the real `DEFAULT_GAME_*` data cannot express their scenarios: [`seed-game-data-chunking.test.ts`](../../packages/api/src/__tests__/seed-game-data-chunking.test.ts) needs a mix wide enough to overflow D1's 100-bind-param cap, and [`seed-game-data-unresolvable-variant.test.ts`](../../packages/api/src/__tests__/seed-game-data-unresolvable-variant.test.ts) needs a mix whose `variantKeys` do not all resolve to a seeded variant.

## Web test gotchas

### vi.mock factory hoisting (TDZ)

`vi.mock()` factories are hoisted **before** variable declarations, so a factory that closes over a module-scope `const` throws a baffling TDZ `ReferenceError` at runtime. Create every `vi.fn()` inline inside the factory, or via `vi.hoisted` (AGENTS.md's mocking conventions).

### The trpc/env stub pattern

`@/utils/trpc` のimportは環境変数の検証と実clientを読み込む。独立した状態を検証するunitでは必要な通信依存をmockできるが、画面連携では実client・QueryClient・フォームを通し、MSWでHTTP応答を制御する。環境設定だけをテストURLへ切り替え、clientそのものの置換を全jsdomテストに義務づけない。環境変数のlazy proxyは [`web-platform.md`](web-platform.md) を参照する。

[`integration.tsx`](../../apps/web/src/__tests__/integration.tsx) はtRPC標準fetch adapterでbatch/serializationを扱い、各画面に独立したmemory historyを作る。jsdomにはanimation timelineがないため、Radix Presenceが発生しないanimationendを待たないよう、このrender内だけanimation-nameをnoneにする。実アニメーションやレイアウトの保証には数えない。

### createTrpcMock and the queryKey shape

[`apps/web/src/__tests__/test-utils.tsx`](../../apps/web/src/__tests__/test-utils.tsx) exposes `createTrpcMock()`: an auto-materializing mock of the tRPC client/proxy shape — access any path (`mock.currency.list.query`) and receive a typed `vi.fn()`. Two contracts around it:

- A test that hand-mocks `queryOptions` must return a **stable queryKey of shape `[namespace, procedure, input]`** so key-derivation helpers (e.g. `getSessionQueryKeys`) resolve predictable keys, and must import the module under test **after** `vi.mock` so it picks up the mocked trpc.
- For hooks driven by a **real** QueryClient, the mocked `list.queryOptions(input)` must build an input-scoped queryKey plus a queryFn forwarding the input, so the real QueryClient can seed cache entries and refetch predictably per `screenKey`.

### Rollback and overlapping mutations

`onSettled` の再取得が復旧後の値を返すと、rollback自体が欠けていても成功する。rollbackを検証するケースでは再取得を保留し、失敗直後の実QueryClientを確認してから応答を解放する。queryFnに復旧値を返させるだけでは、rollbackの検出証拠にしない。

`beginOptimisticQueryUpdate` は同一queryへの更新を投入順に保持し、失敗した操作を除いて再適用する。createに楽観的な仮行がなくても、完了時の再取得はpendingのedit/deleteを消し得るため、同じ更新群に参加する。全writerが開始前にqueryをcancelし、再適用可能な確定値だけでcacheを更新し、各onSettledで一度だけsettleする。最後のsettleだけが再取得を開始する。詳しい使用規約は [web-data-fetching.md](../../.claude/rules/web-data-fetching.md) に置く。外部のfocus/reconnect/manual refetchまで直列化する機構ではない。

## Deterministic time in tests

**`withTz`** ([`apps/web/src/__tests__/tz.ts`](../../apps/web/src/__tests__/tz.ts)) provides deterministic time-zone control for date-formatting tests (SA2-145 — CI/local divergence). Node/Bun re-reads `process.env.TZ` on every `Date` operation, so wrapping an assertion in `withTz` exercises a specific zone regardless of the host machine. Design points:

- The pristine host zone is captured once at module load and restored in a `finally`, so a test can never leak a zone into sibling files sharing the same worker.
- **When the host had no `TZ` set, the restore must actually delete the variable.** `process.env.TZ = undefined` coerces to the string `"undefined"`, which Node treats as an invalid zone and silently falls back to UTC (SA2-145) — leaking instead of restoring the pristine "no TZ" state. `Reflect.deleteProperty` is used because `lint/performance/noDelete` forbids the `delete` operator.
- Canonical zones: `TZ_WEST = "America/Los_Angeles"` (reproduces the original off-by-one bug), `TZ_EAST = "Asia/Tokyo"`, plus UTC itself.

The `mcp` Vitest project pins `env: { TZ: "Asia/Tokyo" }` for the same reason: date assertions must not depend on the host timezone, and a non-UTC zone makes any accidental local-getter usage fail loudly ([`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md)).

**Expiry fixtures are relative, never fixed dates.** `buildMcpSession` rejects expired tokens, so a hard-coded future timestamp turns the whole suite red once the clock passes it — fixtures compute expiry relative to `Date.now()`.

## bun:sqlite migration tests

Migration specs (`packages/db/src/__tests__/migration-*.test.ts`, `preview-seed-restore.test.ts`) run against `bun:sqlite` — a real SQLite engine, matching what D1 executes. `bun:sqlite` is only available in the Bun runtime, so CI runs these files in a dedicated **`bun test` step** ("Test migrations with Bun SQLite" in [`ci.yml`](../../.github/workflows/ci.yml)), while a `skipIfNotBun` guard makes Vitest's Node projects intentionally skip the bodies — the skip that creates the silent-green hole `scripts/check-rules.ts` closes (see below). Every such spec needs the fixed two-directive import waiver — TypeScript has no `bun:sqlite` types under the workspace's Node-flavored config, and the `Bun` global only exists at runtime in Bun:

```ts
// @ts-expect-error -- bun:sqlite only exists in the Bun runtime.
// biome-ignore lint/correctness/noUndeclaredVariables: Bun is a runtime global
```

The shared `applyThrough(marker)` helper applies only the statements up to and including the first one matching `marker`, **without** a transaction — exactly the state a production apply that dies mid-file leaves behind (`wrangler` streams statements and records the migration only after the last succeeds). The rules these specs pin — mid-file death, abort-proof backfills, self-healing retry — live in [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md).

## The preview/dev seed-restore pipeline tests

[`preview-seed-restore.test.ts`](../../packages/db/src/__tests__/preview-seed-restore.test.ts) pins the semantics of a pipeline that lives in **two hand-copied workflow siblings**: `preview-deploy.yml` (new preview DB) and `dev-deploy.yml` (every deploy — the dev DB is dropped and recreated each time) both seed a brand-new D1 by applying every migration and then replaying a `--no-schema` dump of production. The trigger-collision story and the stash design are owned by [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md); `bun run check:rules` separately asserts that every workflow performing the restore carries the stash. What the test file adds:

- **It pins both halves of the fix**: the collision is real (so nobody "simplifies" the trigger stash away), and stashing the triggers around the restore keeps the dump the single source of truth without leaving the DB permanently trigger-less. `readTriggers` in the test is **the exact query the seed steps run**; a post-seed write must still fire the compat trigger — the stash is scoped to the restore, not a permanent disarm.
- **The 0049-naming caveat.** Only the first test case names 0049's compat triggers; when the contract migration drops the legacy `games` mirror, that case stops throwing. The fix is to re-point it at whatever derived-table trigger remains (or delete the file once none do) — **not** to conclude the stash is unnecessary. Every other case reads live triggers out of `sqlite_master` and never names 0049.
- **Re-arm idempotency.** The workflows' re-arm file is `cat drop-triggers.sql restore-triggers.sql` — the drops are what make it idempotent. SQLite strips `IF NOT EXISTS` before storing DDL in `sqlite_master`, so the read-back CREATEs alone would abort on the first surviving trigger — and `wrangler d1 execute --file` stops there, skipping every CREATE behind it.

## scripts/check-rules.ts

[`scripts/check-rules.ts`](../../scripts/check-rules.ts) holds the deterministic conformance checks for the rules in AGENTS.md and `.claude/rules/*.md`. It runs in CI ([`ci.yml`](../../.github/workflows/ci.yml)), the Claude Code Stop hook, and manually via `bun run check:rules`.

**Standing invariant: only currently-green checks may live in the file.** A red check would block every turn (the Stop hook runs it after each Claude Code turn). Checks for known-but-unfixed issues wait here until their Linear issues are fixed — currently the ColorBadge / PlayerAvatar wrapper bans (SA2-112, SA2-119).

### Matching soundness (excludeLine × multiline)

Each pattern is tested against the whole file first — so multiline patterns can match — and then per line for reporting; `excludeLine` filters individual line hits. A file that matched as a whole while **no single line matched** is reported as a genuine multiline violation. The guard for that fallback is "no line matched at all", not "the check has no excludeLine": this stays sound when a check combines an `excludeLine` with a multiline pattern — a file whose every hit line is excluded is not reported, but a real cross-line hit still is.

### The bun:sqlite listing check

`bun:sqlite` spec bodies sit behind `skipIfNotBun`, so Vitest reports them as *skipped*, not failed — a spec also missing from ci.yml's dedicated `bun test` step **runs nowhere and reports green**. The check is a **cross-file existence assertion** (every `{apps,packages}/**/__tests__/*.test.ts` mentioning `bun:sqlite` must be named in the step), which is why it lives outside the file's generic `CHECKS` table. The glob spans **every workspace**, not just `packages/db`: tests are colocated next to code, so the next bun:sqlite spec plausibly lands in some other `__tests__/`, and `*` does not cross `/` — a narrower glob would let such a spec escape both this check and the `bun test` step, the exact hole the check exists to close.

### The D1 trigger-stash check (delta beyond db-migrations.md)

- **It matches on the restore itself** (`--file=dump.sql`), not on a workflow allowlist — the seed step is a hand-copied sibling across `preview-deploy.yml` / `dev-deploy.yml`, and a copy is precisely what prose cannot keep in sync, so matching the restore marker catches the *next* copy of the step too.
- **The three stash markers are asserted separately** because each is a distinct half of the fix; in particular a workflow that dropped without re-arming would leave the DB permanently trigger-less, so a missing re-arm must fail on its own.
- Implementation trap: `dot: true` on the Glob scan is load-bearing — Bun's `Glob` skips dot-directories by default, so without it the scan of `.github/` yields an empty set and the check reports green forever.

### Regex-design deltas

- **Inline model-id check** (the rule and its why are owned by [`.claude/rules/ai-models.md`](../../.claude/rules/ai-models.md)): it bans **quoted `claude-*` literals wholesale** rather than enumerating generation names — an enumeration would miss the old digit-first id format (`claude-3-5-sonnet-20241022`). Requiring the quotes keeps `.claude/rules/...` paths and prose out of scope; workflow YAML is excluded because `--model opus` is a movable alias, not a pinned ID.
- **MCP direct-DB-import check** ([`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 2 owns the rule): the pattern matches the `@sapphire2/db` **prefix**, so barrel imports (`createDb` / schema re-exports) are blocked as well as subpath imports — matching subpaths only would let the bare barrel import pass.
