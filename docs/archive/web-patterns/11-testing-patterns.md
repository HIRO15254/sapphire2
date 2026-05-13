# Testing Patterns — Vitest / TDD

UI リライト前の現状記録。`apps/web` を含む sapphire2 全体のテスト戦略を、ファイル根拠付きで一通り棚卸しする。`vitest.config.ts`（リポジトリ root）と各 workspace の `vitest.config.ts`、`apps/web/src/__tests__/test-utils.tsx`、`packages/api/src/__tests__/test-utils.ts`、CLAUDE.md の TDD セクションが、本ドキュメントの一次資料である。リライト後にプロジェクト分割を畳むか保つか、test-utils をどこに置くか、TDD の運用厳格度をどう保つか — それらの判断材料を残すことを目的とする。

## 何を解決しているか

sapphire2 のテストレイヤーは、互いに別物である 3 種類のランタイム（**jsdom** / **Node** / **D1 schema introspection**）を 1 つのリポジトリに同居させながら、以下の痛点をまとめて潰しに行く。

- **ランタイム混在のコスト分離**。React コンポーネント・`renderHook`・TanStack Router・Better Auth クライアントは jsdom が必要。一方、Zod スキーマ・フォーマッタ・楽観更新ヘルパーのようなピュア関数は Node だけで十分で、jsdom を毎回ブートしているとローカル / CI の双方で待ち時間が肥大する。これを Vitest の `projects` で **`web-dom` / `web-node` / `api` / `db` / `env`** の 5 本に切り分け、ファイル名 glob で行き先を強制する。Windows で `bun run test` が数分かかる事情への対処でもある（CLAUDE.md「Do NOT run the full test suite during a task」）。

- **ボイラ削減と一貫性**。tRPC の proxy をモックするのも、`QueryClientProvider` でラップするのも、Better Auth の `authClient.useSession()` を差し替えるのも、トースト呼び出しを spy するのも、どのテストファイルでも繰り返し必要になる。これを `apps/web/src/__tests__/test-utils.tsx` の **6 つのヘルパー**（`createTestQueryClient` / `withQueryClient` / `renderWithQueryClient` / `createTrpcMock` / `createToastMock` / `createAuthClientMock` + 2 つのスタブ）に集約し、新しい mocking パターンを各テストが発明することを禁じる。

- **tRPC router の Zod 入力検証を hand-roll しない**。`packages/api/src/__tests__/test-utils.ts` の `getInputSchema` / `expectAccepts` / `expectRejects` / `expectProtected` / `expectType` の 5 関数で、procedure の入力スキーマ・middleware 段数・procedure type を統一の方法で検証する（[`packages/api/src/__tests__/player.test.ts`](../../../packages/api/src/__tests__/player.test.ts) がリファレンス）。これにより 20 個のルータが同じ網目でテストされる。

- **TDD 強制による回帰防止**。CLAUDE.md TDD セクションが定める「コードを 1 行触る前にテストを赤にする」ワークフローが、PR #226（`test/comprehensive-coverage`）の comprehensive coverage sweep を底上げの基準として運用されている。**branch coverage / boundary values / error paths / side-effect 検証** の 4 軸を全 hook / procedure / pure helper に展開しており、smoke test（`toBeDefined()` のみ）は明示禁止。

## 中心となる部品

### 1. Vitest project 分割（5 本）

リポジトリ root の `vitest.config.ts` は `projects: [...]` を並べているだけで、テストランタイム自体は各 workspace の `vitest.config.ts` が持つ。

| project | 環境 | 設定ファイル | include glob | 用途 |
|---|---|---|---|---|
| `web-dom` | `jsdom` | `apps/web/vitest.dom.config.ts` | `src/**/*.test.tsx`<br>`src/shared/hooks/__tests__/*.test.ts`<br>`src/shared/components/**/__tests__/*.test.ts`<br>`src/features/**/components/**/__tests__/*.test.ts`<br>`src/features/**/hooks/__tests__/*.test.ts`<br>`src/features/dashboard/widgets/**/__tests__/*.test.ts`<br>`src/features/sessions/utils/__tests__/share-session.test.ts`<br>`src/routes/**/__tests__/*.test.ts` | コンポーネント / `renderHook` / DOM API / TanStack Router / `authClient` を触る hook |
| `web-node` | `node` | `apps/web/vitest.node.config.ts` | `src/utils/__tests__/*.test.ts`<br>`src/shared/lib/**/__tests__/*.test.ts`<br>`src/features/currencies/utils/__tests__/*.test.ts`<br>`src/features/live-sessions/utils/__tests__/*.test.ts`<br>`src/features/sessions/utils/__tests__/session-filters-helpers.test.ts`<br>`src/features/sessions/utils/__tests__/session-form-helpers.test.ts`<br>`src/features/stores/utils/__tests__/*.test.ts` | フォーマッタ / Zod / 楽観更新ヘルパー / セッション集計の **ピュア関数** |
| `api` | `node` | `packages/api/vitest.config.ts` | `src/**/*.test.ts` | tRPC router の Zod 入力検証 / procedure type / `protectedProcedure` 検証 |
| `db` | `node` | `packages/db/vitest.config.ts` | `src/**/*.test.ts` | Drizzle schema の FK / index / `onDelete` ポリシー検証（`getTableConfig` 経由） |
| `env` | `node` | `packages/env/vitest.config.ts` | `src/**/*.test.ts` | Zod-typed 環境変数の境界値 |

サーバ単独（`apps/server/vitest.config.ts`、name `server`）も同じ要領で並んでいるが、現状ルータ実体は `packages/api` 側にあるため空に近い。

#### `web-dom` の特殊設定

`apps/web/vitest.dom.config.ts` は `isolate: true`（default）を **明示的に維持**する。コメントいわく「`vi.mock` で同じモジュール（例: `@/lib/auth-client`）を異なるテストファイルが別形にモックしているため、`isolate: false` だと last-write-wins で先のテストが壊れる」。setup ファイル `apps/web/src/__tests__/setup.ts` は以下を貼り付ける：

- `@testing-library/jest-dom/vitest`
- `ResizeObserver` のダミー実装
- `HTMLElement.prototype.hasPointerCapture` / `releasePointerCapture` / `scrollIntoView` / `setPointerCapture` のスタブ（Radix UI 由来）
- `afterEach(cleanup)`

#### `web-node` の高速化

`isolate: false` で 1 worker を再利用する。「全テストが `vi.mock` を module-scope で行い、`beforeEach` で state をリセットしているため安全」とコメントに根拠が書いてある。

### 2. `apps/web/src/__tests__/test-utils.tsx` のヘルパー

| Export | 戻り値 | 1 行説明 |
|---|---|---|
| `createTestQueryClient()` | `QueryClient` | `retry: false` / `gcTime: 0` / `staleTime: Infinity` の最小構成。 |
| `withQueryClient(client?)` | `FC<{children}>` | `renderHook` / `render` の `wrapper` に渡す `QueryClientProvider`。 |
| `renderWithQueryClient(ui, { queryClient? })` | `RenderResult & { queryClient }` | `render` 結果に QueryClient を載せて返し、テスト側で `setQueryData` でシードできる。 |
| `createTrpcMock()` | `TrpcRoot`（Proxy） | `mock.currency.list.query` のような任意パスに対し `mutate` / `query` / `mutationOptions` / `queryOptions` を自動生成する Proxy。`vi.mock("@/utils/trpc", () => ({ trpc, trpcClient }))` 用。 |
| `createToastMock()` | `{ success, error, info, warning, message, loading, dismiss }` | sonner の `toast` 表面を全部 `vi.fn()` で並べる。 |
| `createAuthClientMock(session?)` | Better Auth `authClient` 表面 | `useSession` / `signIn.email` / `signIn.social` / `signUp.email` / `signOut` / `getSession` の最小セット。 |
| `createMutationStub<TInput, TOutput>(fn?)` | `UseMutationResult` | `mutation.isPending` と `mutate` だけ参照したい時に押し込む偽 result。 |
| `createQueryStub<TData>(data, isLoading?)` | `UseQueryResult` | `data` を据えた偽 query result。 |

`createTrpcMock` の Proxy には `then` を読まれた時に `undefined` を返す細工が入っている（`await mock` でうっかり thenable resolution に巻き込まれないため）。

### 3. `packages/api/src/__tests__/test-utils.ts` のヘルパー

tRPC v11 の procedure ランタイム形（`procedure._def`）に依存して、router テストを最短行数で書くための薄いラッパ。

| Export | 用途 |
|---|---|
| `getProcedureDef(procedure)` | `procedure._def` を取り出す（無ければ throw）。 |
| `getInputSchema(procedure)` | `def.inputs[0]` を Zod-like schema として取り出す（`safeParse` を持つこと）。 |
| `expectAccepts(procedure, input)` | 入力スキーマが受理することをアサート。失敗時は input を JSON.stringify して例外メッセージに乗せる。 |
| `expectRejects(procedure, input)` | 受理しないことをアサート。同上。 |
| `expectProtected(procedure)` | `def.middlewares.length >= 2`（base resolver + protection middleware）であることをアサート。 |
| `expectType(procedure, "mutation" \| "query" \| "subscription")` | procedure type をアサート。 |

5 関数のおかげで、`player.list / getById / create / update / delete` の 5 procedure を **type / protected / input schema** の 3 軸でなぞるテストが 1 ファイル 200 行以内で書ききれる（[`packages/api/src/__tests__/player.test.ts`](../../../packages/api/src/__tests__/player.test.ts)）。

### 4. `vi.hoisted` パターン

`vi.mock` ファクトリは hoist されるため、mocks の参照を `vi.hoisted` で先に作る。これが現行リポジトリの**唯一の mock 共有手段**として標準化されている。

```ts
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useSession: vi.fn(() => ({ isPending: false })),
  signInEmail: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: mocks.useSession,
    signIn: { email: mocks.signInEmail },
  },
}));

import { useSignIn } from "@/shared/components/sign-in-form/use-sign-in";
```

（[`apps/web/src/shared/components/sign-in-form/__tests__/use-sign-in.test.ts`](../../../apps/web/src/shared/components/sign-in-form/__tests__/use-sign-in.test.ts) より抜粋）

ポイントは 3 つ：

1. `vi.hoisted(() => ({ … }))` の戻り値を `mocks` に束ねる。
2. `vi.mock("module", () => ({ … }))` の中で `mocks.xxx` を参照する（hoist 順序が一致するので safe）。
3. **被テストモジュールの import は `vi.mock` の後**に置く。先に書くと mock 適用前にバインドが走ってしまう。

### 5. パターン別リファレンス実装の対応表

CLAUDE.md TDD セクションの表をそのまま転記しつつ、各リファレンスが「なぜそのプロジェクトに属するか」を補足する。新規テストを書くときは、まず**自分のターゲットがどの行に当たるか**を判定してから、該当ファイルの構造をコピーする。

| ターゲット種別 | project | リファレンス実装 | 何を真似るか |
|---|---|---|---|
| Pure util / Zod schema / formatter | `web-node` | [`features/stores/utils/__tests__/blind-level-helpers.test.ts`](../../../apps/web/src/features/stores/utils/__tests__/blind-level-helpers.test.ts), [`utils/__tests__/format-number.test.ts`](../../../apps/web/src/utils/__tests__/format-number.test.ts) | factory 関数（`function level(overrides) { ... }`）で valid input を組み、`describe` を分岐ごとに切る。`null` / 空配列 / 1 件 / 複数件 / 境界の 5 ケースを並べる。 |
| Simple hook（tRPC 不要） | `web-dom` | [`shared/hooks/__tests__/use-elapsed-time.test.ts`](../../../apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts) | `vi.useFakeTimers()` + `vi.setSystemTime(NOW)` で時刻固定。`act(() => vi.advanceTimersByTime(...))` で interval を進める。unmount で `clearInterval` が呼ばれることまで spy。 |
| Form hook (`@tanstack/react-form`) | `web-dom` | [`shared/components/sign-in-form/__tests__/use-sign-in.test.ts`](../../../apps/web/src/shared/components/sign-in-form/__tests__/use-sign-in.test.ts) | `vi.hoisted` で `navigate` / `useSession` / `signInEmail` / `toast.*` を束ね、`vi.mock` 3 つで `@tanstack/react-router` / `sonner` / `@/lib/auth-client` を差し替え。real `useForm` を `act` で駆動。 |
| tRPC query + mutation hook（楽観更新あり） | `web-dom` | [`features/currencies/hooks/__tests__/use-currencies.test.ts`](../../../apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts) | inline で `buildKey` を組み、`vi.mock("@/utils/trpc", () => ({ trpc: { ... queryOptions: () => ({ queryKey, queryFn }) }, trpcClient }))` 形。real `QueryClient` を `setQueryData` でシードし、`mutation` の resolve を遅延させて `isCreatePending` 遷移を観測。 |
| 楽観フロー × real QueryClient | `web-dom` / `web-node` | [`features/live-sessions/utils/__tests__/optimistic-session-event.test.ts`](../../../apps/web/src/features/live-sessions/utils/__tests__/optimistic-session-event.test.ts) | `snapshotQuery` / `restoreSnapshots` のヘルパーを通した rollback の 5 段検証（snapshot → mutate → onError → restore → onSettled invalidate）。 |
| Route page hook | `web-dom` | [`routes/__tests__/use-dashboard-page.test.ts`](../../../apps/web/src/routes/__tests__/use-dashboard-page.test.ts) | 複数 feature hook の合成を mock し、page 全体の loading / error / empty 分岐をアサート。 |
| API router | `api` | [`packages/api/src/__tests__/player.test.ts`](../../../packages/api/src/__tests__/player.test.ts) | `appRouter.<ns>` に対し `Object.keys` の集合を fix、各 procedure に `expectProtected` / `expectType` / `expectAccepts` / `expectRejects` を並べる。 |
| DB schema | `db` | [`packages/db/src/__tests__/session-schema.test.ts`](../../../packages/db/src/__tests__/session-schema.test.ts) | `getTableConfig(table)` で FK / index / `onDelete` を直接読む。migration SQL ではなく schema TS を真実とする。 |

### 6. `vi.mock("@/utils/trpc", ...)` パターン

`apps/web` の hook テストでは、**tRPC proxy を直接モックする** ことが標準。`createTrpcMock()` を使う場合と、`use-currencies.test.ts` のように queryKey を 1 行 helper で組み立てて inline で書く場合の 2 通りがある。後者の方が「`queryOptions` が返す `queryKey` をテスト側が制御できる」ので、optimistic 検証で `qc.setQueryData(KEY, ...)` をシードできて好まれる。

```ts
function buildKey(namespace: string, procedure: string, input: unknown) {
  return input === undefined
    ? [namespace, procedure]
    : [namespace, procedure, input];
}

vi.mock("@/utils/trpc", () => ({
  trpc: {
    currency: {
      list: {
        queryOptions: () => ({
          queryKey: buildKey("currency", "list", undefined),
          queryFn: () => Promise.resolve([]),
        }),
      },
    },
    // ...
  },
  trpcClient: {
    currency: {
      create: { mutate: trpcMocks.currencyCreate },
      // ...
    },
  },
}));
```

（[`apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts`](../../../apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts) より抜粋）

### 7. 実行コマンドの早見表

CLAUDE.md TDD セクションが定義する scoped run の語彙：

| 状況 | コマンド |
|---|---|
| Pure 関数 / Zod / フォーマッタを書いた | `bunx vitest run --project web-node <path>` |
| Hook / component / route page を書いた | `bunx vitest run --project web-dom <path>` |
| tRPC router を書いた | `bunx vitest run --project api <path>` |
| Drizzle schema を書いた | `bunx vitest run --project db <path>` |
| env 変数の Zod を書いた | `bunx vitest run --project env` |
| ステージ中のファイルに関連するテストだけ | `bunx vitest related --run $(git diff --cached --name-only ...)`（pre-commit が自動） |
| `rtk` がある場合 | `rtk vitest <args>`（user feedback、未導入なら `bunx vitest`） |
| 最終確認 | Claude Code の Stop hook が `ultracite fix && vitest run --changed HEAD && ultracite check` を自動発火 |

`bun run test` を作業中に直接叩くのは禁忌。`CLAUDECODE=1` 環境では pre-commit が skip されるのも同じ理由（hook 側で品質ゲートを担保する）。

## 典型フロー

`use-currencies.ts` の `create` mutation に「楽観追加 → server 応答待ち → `isCreatePending` を立てる」branch を新規追加する場合の workflow を、実テストの抜粋で追う。

**Step 1: 赤を書く**。`web-dom` project に `__tests__/use-currencies.test.ts` を作成、`vi.hoisted` でモック束を用意し、real `QueryClient` を立ててからテストを書く。

```ts
it("isCreatePending flips true during in-flight mutation", async () => {
  const qc = createClient();
  qc.setQueryData(CURRENCY_KEY, []);
  let resolve: ((v: unknown) => void) | undefined;
  trpcMocks.currencyCreate.mockImplementation(
    () => new Promise((r) => { resolve = r; })
  );
  const { result } = renderHook(() => useCurrencies(null), {
    wrapper: makeWrapper(qc),
  });
  act(() => {
    result.current.create({ name: "Gold" });
  });
  await waitFor(() => expect(result.current.isCreatePending).toBe(true));
  resolve?.({ id: "new" });
  await waitFor(() => expect(result.current.isCreatePending).toBe(false));
});
```

ポイント：

- **real `QueryClient`** を `createClient()` で立てる（`createTestQueryClient` 相当）。stub ではなく実体を使うことで、`setQueryData` / `getQueryData` / `invalidateQueries` の挙動まで検証できる。
- **mutation の resolve を遅延**させて in-flight 状態を作る。`new Promise((r) => { resolve = r; })` を `mockImplementation` で返し、`act` で `create` を呼んだ後に `waitFor` で `isCreatePending: true` を観測 → `resolve` を呼んで `false` への遷移も観測。
- **`act` の二重使い**: 状態更新は `act(...)`、その後の non-sync な reflect は `await waitFor(...)`。

**Step 2: 実装**。`use-currencies.ts` 側で `mutation.isPending` を `isCreatePending` として返す。

**Step 3: branch coverage を埋める**。同じ describe で `onMutate: no-op when cache is undefined`（cache 未シード時の guard）、`optimistically appends a temp currency entry during mutation`（temp ID の正規表現マッチ）、`forwards unit as null when unit omitted`（null 落とし込み）の 3 ケースを追加。`expect(trpcMocks.currencyCreate).toHaveBeenCalledWith({ name: "No unit" })` のように **`toHaveBeenCalled()` ではなく引数まで含めてアサート**する。

**Step 4: error path を追加**。

```ts
it("keeps local state consistent through an error path (optimistic remove + rollback attempted)", async () => {
  // ... setQueryData で 1 件シード
  trpcMocks.txDelete.mockRejectedValue(new Error("server down"));
  // act 内で deleteTransaction を呼び、microtask を flush
  await act(async () => {
    result.current.deleteTransaction("tx1");
    await Promise.resolve();
  });
  await waitFor(() =>
    expect(trpcMocks.txDelete).toHaveBeenCalledWith({ id: "tx1" })
  );
});
```

`mockRejectedValue` + `await Promise.resolve()` で microtask を 1 周回し、`onError` ハンドラの起動を待ってから assert する。

**Step 5: 緑のまま、Stop hook 任せ**。CLAUDE.md の TDD セクションは「**作業中は scoped run（`bunx vitest run --project web-dom <path>`）のみ。フル suite は Stop hook（`ultracite fix && vitest run --changed HEAD && ultracite check`）に任せる**」と定める。手元で `bun run test` を回すと Windows では数分待つことになるため、scoped run + Stop hook の二段構えで時間を切る。

### pure helper 側の典型フロー

ピュア関数では `vi.mock` も `renderHook` も不要で、factory + describe ツリーで分岐を網羅する。`blind-level-helpers.test.ts` の `getEffectiveLastMinutes` がリファレンス：

```ts
function level(overrides: Partial<BlindLevelRow> = {}): BlindLevelRow {
  return {
    id: "lvl-1",
    tournamentId: "tn-1",
    level: 1,
    isBreak: false,
    blind1: 100,
    blind2: 200,
    blind3: null,
    ante: null,
    minutes: 20,
    ...overrides,
  } as BlindLevelRow;
}

describe("getEffectiveLastMinutes", () => {
  it("returns the supplied lastMinutes directly when not null", () => {
    expect(getEffectiveLastMinutes(15, [])).toBe(15);
  });

  it("returns null when there are no levels and lastMinutes is null", () => {
    expect(getEffectiveLastMinutes(null, [])).toBeNull();
  });

  it("walks levels from the end to find the last non-null minutes", () => {
    const levels: BlindLevelRow[] = [
      level({ id: "a", minutes: 10 }),
      level({ id: "b", minutes: 20 }),
      level({ id: "c", minutes: null }),
    ];
    expect(getEffectiveLastMinutes(null, levels)).toBe(20);
  });

  it("returns null when all levels have null minutes", () => {
    const levels = [
      level({ id: "a", minutes: null }),
      level({ id: "b", minutes: null }),
    ];
    expect(getEffectiveLastMinutes(null, levels)).toBeNull();
  });
});
```

ポイント：

- `level(overrides)` factory が **defaults を 1 箇所に集約**する。各 it では「テストで意味のあるフィールドだけ overrides に書く」スタイルが徹底されている。
- describe の各 it は **1 つの分岐に対応**。`getEffectiveLastMinutes` の実装は「`lastMinutes !== null` を early return → levels を末尾から走査 → 全て null なら null」の 3 分岐で、テストもちょうど 3 + 1 件（boundary の `[]` で 4 件目）。
- このタイプのファイルは `web-node` に置き、jsdom コストを払わない。

### router test の典型フロー

`packages/api/src/__tests__/player.test.ts` は 4 つの describe で **構造 / 各 procedure / 入力スキーマ / 境界値** をなぞる。

```ts
describe("player router structure", () => {
  it("exposes exactly the expected procedure set", () => {
    expect(Object.keys(appRouter.player).sort()).toEqual(
      ["create", "delete", "getById", "list", "update"].sort()
    );
  });

  it("create / update / delete are protected mutations", () => {
    for (const proc of [
      appRouter.player.create,
      appRouter.player.update,
      appRouter.player.delete,
    ]) {
      expectProtected(proc);
      expectType(proc, "mutation");
    }
  });
});

describe("player.create input validation", () => {
  it("rejects empty name", () => {
    expectRejects(appRouter.player.create, { name: "" });
  });

  it("rejects name exceeding max length (100)", () => {
    expectRejects(appRouter.player.create, { name: "a".repeat(101) });
  });

  it("accepts name at exactly 100 characters (boundary)", () => {
    expectAccepts(appRouter.player.create, { name: "a".repeat(100) });
  });

  it("rejects memo exceeding 50_000 characters", () => {
    expectRejects(appRouter.player.create, {
      name: "Alice",
      memo: "a".repeat(50_001),
    });
  });
});
```

「100 文字を受理、101 文字を拒否、50_000 文字を受理、50_001 文字を拒否」の **boundary 4 連打** が router 全体で繰り返される。test 関数の中身は 1〜2 行に収まり、test 名が boundary の値を直接記述するので、回帰時の原因特定が秒で済む。

## 決定と理由

| # | 決定 | 理由 |
|---|---|---|
| 1 | **Vitest project を 5 分割**（`web-dom` / `web-node` / `api` / `db` / `env`） | jsdom ブートコストが pure helper テストに伝播するのを防ぐ。Windows での `bun run test` 待ち時間が数分単位という事情がある（CLAUDE.md）。`web-node` は `isolate: false` で 1 worker 再利用、`web-dom` は **`isolate: true` を明示維持**（`@/lib/auth-client` のような頻繁モック対象が last-write-wins で壊れるため）。 |
| 2 | **テストは colocate**（同階層 `__tests__/` または `<component>.test.tsx` を component ディレクトリに同居） | コードと対応 test が PR diff で必ず一緒に動く。リファクタで feature が移動しても test も追従できる。`features/<x>/components/<c>/<c>.test.tsx` と `features/<x>/hooks/__tests__/use-*.test.ts` の 2 形態を併存。 |
| 3 | **Black-box テスト** — hook が公開する戻り値（`state` / `handlers` / `derived` / `is*Pending`）と side-effect（toast 呼び出し / queryClient 状態 / navigate 呼び出し）だけをアサートする | hook 内部の `useState` / `useMemo` / `useRef` を直接触らない。`.claude/rules/web-hooks-separation.md` の境界線がそのままテストの境界線になる。test 名は scenario 記述（`"rejects empty name with 'Required'"`）にし、`"test 1"` のような mechanics 名は禁止。 |
| 4 | **全件 suite は CI / hook に任せ、開発中は scoped run** | `bunx vitest run --project web-node <path>` で pure 関数を秒で回す。`bunx vitest related --run $(git diff --cached --name-only ...)` は pre-commit が走らせる。フル suite は Claude Code の Stop hook が末尾に発火（`bun x ultracite fix && bun x vitest run --changed HEAD && bun x ultracite check`）。pre-commit は `CLAUDECODE=1` 時にスキップ。 |
| 5 | **`test-utils` を増やすことで「新しい mocking パターンを発明しない」** | `apps/web/src/__tests__/test-utils.tsx` / `packages/api/src/__tests__/test-utils.ts` が 2 大集約点。既存パターンに当てはまらないターゲットが現れたら、**ヘルパーを拡張する**（テストごとに hand-roll しない）。CLAUDE.md TDD セクションが「If a target does not match any pattern above, extend the relevant test-utils file with a new helper」と明言。 |
| 6 | **`renderHook` を component test より優先**（"When the logic is the point, prefer testing the hook over the component"） | `.claude/rules/web-hooks-separation.md` でロジックは hook 側に寄せているため、`@testing-library/react` の `renderHook` で hook を単独テストする方が JSX 由来のノイズを排除できる。component test は「JSX が hook の戻り値を正しく投影しているか」だけを見る。 |
| 7 | **`@tanstack/react-form` は real `useForm` を使い、`result.current.form.setFieldValue` + `await result.current.form.handleSubmit()` を `act()` で駆動** | `useForm` を `vi.mock` しない理由は、form の state machine 自体に意味のあるロジック（validators、`onSubmit` の async chain）が乗っていて、stub すると検証点が消えるため。`form.setFieldValue` → `form.handleSubmit` の 2 段は state を 2 回書き換えるので `act` 必須。 |
| 8 | **`vi.hoisted` を mock 共有の唯一の手段に固定** | `vi.mock` は hoist されるため、mock factory から module-scope 変数を読むと `ReferenceError`。`vi.hoisted(() => ({ … }))` を全テストで採用することで、`beforeEach` での reset / `mockReturnValueOnce` での個別 override が同じ形になる。 |
| 9 | **tRPC は proxy を `vi.mock("@/utils/trpc", () => ({ trpc, trpcClient }))` で差し替える** | 全 hook が `@/utils/trpc` を import するため、ここを 1 箇所モックすれば router 全体が切り離せる。`createTrpcMock()` の auto-materializing Proxy で「触ったパス分だけ `vi.fn` が生える」ので、テスト本体は `trpcMocks.currencyCreate.mockResolvedValue(...)` の形で書ける。 |
| 10 | **router test は `appRouter.<namespace>.<procedure>` を直接 `_def` 経由で検証**（real DB 接続なし） | `expectAccepts` / `expectRejects` で Zod schema の境界値（`name` 100 文字 / 101 文字、`memo` 50_000 文字 / 50_001 文字 …）を網羅。`expectProtected` で middleware 段数を見るだけで `protectedProcedure` か否か判定。これで procedure 単位の検証が **DB を立てずに完結**する。 |
| 11 | **DB schema は Drizzle の `getTableConfig` で introspection** | テスト用 D1 を立てる代わりに、`getTableConfig(table).foreignKeys` / `.indexes` / `.checks` を直接読んで constraint をアサートする。`packages/db/src/__tests__/session-schema.test.ts` がリファレンス。スキーマ変更が **migration ファイルと test の双方を要求**する形になり、漏れを抑える。 |

## 落とし穴

- **Windows で `bun run test` が遅い**: jsdom + Node × 5 project の同時起動コストで、CLAUDE.md が明示的に「**フル suite を作業中に回すな**」と書いている。scoped run（project と path を絞る）に徹し、最終確認は Stop hook 任せ。
- **`vi.mock` の hoisting と import 順**: `vi.mock("@/utils/trpc", ...)` を書いた **後** で `import { useCurrencies } from "@/features/.../use-currencies"` する。逆順だと mock 適用前にバインドされ、real `trpc` が走って network call が試みられる（jsdom 環境では刺さる）。`use-sign-in.test.ts` / `use-currencies.test.ts` の冒頭が範例。
- **real `useForm` を使ったときの `act()` の必要性**: `form.setFieldValue` も `form.handleSubmit` も state 更新を起こす。`act` 抜きで連打すると warning が出て、`expect(form.state.errors).toEqual(...)` が古い state を読む。`await result.current.form.handleSubmit()` を `await act(async () => { ... })` で包む。
- **smoke test（`toBeDefined()` のみ）の禁止**: PR #226 の sweep 以降、`expect(x).toBeDefined()` だけのテストは review で reject される。**branch / boundary / error path** の 3 軸を全 hook で埋めるのが標準で、`use-currencies.test.ts`（681 行 / 25+ ケース）がその水準を示すリファレンス。
- **`toHaveBeenCalled()` ではなく `toHaveBeenCalledTimes` + `toHaveBeenNthCalledWith` を強制**: 「呼ばれた」だけだと、引数が違っても気付けない。create mutation で `mutate({ name: "Gold" })` を渡したつもりが `{ name: "" }` になっていた、というクラスのバグは `toHaveBeenCalledWith` で初めて落とせる。同様に、`invalidateQueries` が **何回 / どのキーで** 呼ばれたかも `toHaveBeenCalledTimes(2)` + `toHaveBeenNthCalledWith(1, ...)` の組で固定する。
- **`web-dom` の `isolate: true` を維持する理由**: `apps/web/vitest.dom.config.ts` のコメント通り、`@/lib/auth-client` のような頻繁モック対象を `isolate: false` で worker 共有させると、`use-sign-in.test.ts` と `use-sign-up.test.ts` の mock shape が衝突する。ここを `false` にして高速化したくなっても、**衝突が顕在化するまでに数件のテストが silent fail し得る** 罠がある。
- **`Proxy` ベースの `createTrpcMock` の `then` 取り扱い**: Proxy の `get` で `"then"` を読まれた時に `undefined` を返さないと、`await mock` が thenable resolution に入り込んで予期せぬ resolve をする。test-utils 側で対処済みだが、自前で同等 Proxy を書く時は要注意。
- **`vi.useFakeTimers()` 後に `act` が同期 reflect しない**: `use-elapsed-time.test.ts` で `vi.advanceTimersByTime(60_000)` を `act` 内で呼ばないと、`setInterval` callback が React の batched update を介さずに走り、`result.current` が古い値を返す。timer を進めるときは必ず `act` で包む。
- **persister と `gcTime: 0`**: real production の `QueryClient` は `gcTime: 24h` + IndexedDB persister 付きだが、`createTestQueryClient` は `gcTime: 0` で persister なし。両者の差分でテスト緑 / 本番赤になる cache lifecycle 系のバグは原理的に検出できないため、persister 周りは別途 e2e に頼る。

## 関連

- [`./03-data-fetching.md`](./03-data-fetching.md) — tRPC + TanStack Query の構成。本書で扱う `vi.mock("@/utils/trpc", ...)` の差し替え対象が定義されている。
- [`./04-hooks-separation.md`](./04-hooks-separation.md) — components と hooks の境界。テストが `renderHook` 中心になる根拠。
- [`./05-forms.md`](./05-forms.md) — `@tanstack/react-form` + Zod。real `useForm` を `act` で駆動する根拠。
- [`CLAUDE.md`](../../../CLAUDE.md) — TDD セクション（「Test-Driven Development (MANDATORY)」と「Do NOT run the full test suite during a task」）が本書全体の上位規範。
- [`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md) — テストの黒箱境界が一致する rules。
- [`.claude/rules/web-data-fetching.md`](../../../.claude/rules/web-data-fetching.md) — `utils/optimistic-update.ts` を経由した楽観更新が、テストにおける `snapshot → mutate → assert → resolve → invalidate` の 5 段検証として現れる。
