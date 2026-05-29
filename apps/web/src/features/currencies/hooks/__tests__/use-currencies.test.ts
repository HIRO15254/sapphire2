import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks for trpc. infiniteQueryOptions builds a stable queryKey + a queryFn
// that forwards { currencyId, cursor } to txListQueryFn, so the real
// QueryClient can drive useInfiniteQuery, seed pages, and refetch predictably.
// ---------------------------------------------------------------------------

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	currencyCreate: vi.fn(),
	currencyUpdate: vi.fn(),
	currencyDelete: vi.fn(),
	txCreate: vi.fn(),
	txUpdate: vi.fn(),
	txDelete: vi.fn(),
	// queryFn used by useInfiniteQuery(listByCurrency). Called with
	// { currencyId, cursor } per page; per-test override controls each page /
	// refetch payload.
	txListQueryFn: vi.fn(),
}));

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
		currencyTransaction: {
			listByCurrency: {
				infiniteQueryOptions: (
					input: { currencyId: string },
					opts?: {
						enabled?: boolean;
						getNextPageParam?: (lastPage: {
							items: unknown[];
							nextCursor?: string;
						}) => string | undefined;
						initialCursor?: string;
					}
				) => ({
					queryKey: buildKey("currencyTransaction", "listByCurrency", {
						currencyId: input.currencyId,
						type: "infinite",
					}),
					queryFn: ({ pageParam }: { pageParam?: string }) =>
						trpcMocks.txListQueryFn({
							currencyId: input.currencyId,
							cursor: pageParam,
						}),
					initialPageParam: opts?.initialCursor,
					getNextPageParam: opts?.getNextPageParam,
					enabled: opts?.enabled,
				}),
			},
		},
	},
	trpcClient: {
		currency: {
			create: { mutate: trpcMocks.currencyCreate },
			update: { mutate: trpcMocks.currencyUpdate },
			delete: { mutate: trpcMocks.currencyDelete },
		},
		currencyTransaction: {
			create: { mutate: trpcMocks.txCreate },
			update: { mutate: trpcMocks.txUpdate },
			delete: { mutate: trpcMocks.txDelete },
		},
	},
}));

import { useCurrencies } from "@/features/currencies/hooks/use-currencies";

const TEMP_ID_PATTERN = /^temp-/;
const CURRENCY_KEY = ["currency", "list"];
const txInfiniteKey = (currencyId: string) => [
	"currencyTransaction",
	"listByCurrency",
	{ currencyId, type: "infinite" },
];

interface TxRow {
	amount: number;
	id: string;
	memo?: string | null;
	transactedAt: string;
	transactionTypeId?: string;
	transactionTypeName: string;
}

/** Build a seeded infinite-cache entry from one or more pages. */
function seedPages(pages: { items: TxRow[]; nextCursor?: string }[]) {
	return {
		pages,
		pageParams: pages.map((_, i) =>
			i === 0 ? undefined : pages[i - 1]?.nextCursor
		),
	};
}

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useCurrencies", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		trpcMocks.txListQueryFn.mockResolvedValue({
			items: [],
			nextCursor: undefined,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns empty currencies and no transactions when no cache seeded and expandedCurrencyId is null", () => {
			const qc = createClient();
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.currencies).toEqual([]);
			expect(result.current.allTransactions).toEqual([]);
			expect(result.current.hasNextPage).toBe(false);
			expect(result.current.isFetchingNextPage).toBe(false);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isAddTransactionPending).toBe(false);
			expect(result.current.isEditTransactionPending).toBe(false);
		});

		it("does not fetch transactions when expandedCurrencyId is null (query disabled)", () => {
			const qc = createClient();
			renderHook(() => useCurrencies(null), { wrapper: makeWrapper(qc) });
			expect(trpcMocks.txListQueryFn).not.toHaveBeenCalled();
		});

		it("exposes currencies seeded into the cache", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: null, balance: 0 },
				{ id: "c2", name: "Points", unit: "pt", balance: 0 },
			]);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.currencies).toHaveLength(2));
		});
	});

	describe("expanded currency loads transactions", () => {
		it("flattens all pages into allTransactions and reflects a next cursor", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 100,
								transactionTypeName: "Deposit",
								transactedAt: "2026-01-01",
							},
						],
						nextCursor: "cursor-A",
					},
				])
			);
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			expect(result.current.hasNextPage).toBe(true);
		});

		it("sets hasNextPage to false when the last page has no cursor", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 100,
								transactionTypeName: "Deposit",
								transactedAt: "2026-01-01",
							},
						],
						nextCursor: undefined,
					},
				])
			);
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			expect(result.current.hasNextPage).toBe(false);
		});

		it("fetches page 1 via the queryFn with no cursor when nothing is seeded", async () => {
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: [
					{
						id: "tx1",
						amount: 5,
						transactionTypeName: "T",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: undefined,
			});
			const qc = createClient();
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			expect(trpcMocks.txListQueryFn).toHaveBeenCalledWith({
				currencyId: "c1",
				cursor: undefined,
			});
		});
	});

	describe("create (optimistic)", () => {
		it("optimistically appends a temp currency entry during mutation", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: null, balance: 0 },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});

			act(() => {
				result.current.create({ name: "Gold", unit: "g" });
			});

			await waitFor(() => {
				const list =
					qc.getQueryData<
						Array<{ id: string; name: string; unit: string | null }>
					>(CURRENCY_KEY);
				expect(list).toHaveLength(2);
				expect(list?.[1]?.name).toBe("Gold");
				expect(list?.[1]?.unit).toBe("g");
				expect(list?.[1]?.id).toMatch(TEMP_ID_PATTERN);
			});
			resolve?.({ id: "c2" });
		});

		it("forwards unit as null when unit omitted", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: null, balance: 0 },
			]);
			trpcMocks.currencyCreate.mockResolvedValue({ id: "new" });
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({ name: "No unit" });
			});
			expect(trpcMocks.currencyCreate).toHaveBeenCalledWith({
				name: "No unit",
			});
		});

		it("onMutate: no-op when cache is undefined (old === undefined)", async () => {
			const qc = createClient();
			trpcMocks.currencyCreate.mockResolvedValue({ id: "new" });
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({ name: "Free" });
			});
			// The onMutate branch returns old unchanged; no throw.
			expect(trpcMocks.currencyCreate).toHaveBeenCalled();
		});

		it("isCreatePending flips true during in-flight mutation", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
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
	});

	describe("update (optimistic)", () => {
		it("optimistically patches the matching currency", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: null },
				{ id: "c2", name: "Points", unit: "pt" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({ id: "c1", name: "Renamed", unit: "x" });
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<Array<{ id: string; name: string }>>(CURRENCY_KEY);
				expect(list?.[0]?.name).toBe("Renamed");
			});
			resolve?.({ id: "c1" });
		});
	});

	describe("delete (optimistic)", () => {
		it("optimistically removes the currency from the list", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: null },
				{ id: "c2", name: "Points", unit: null },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.delete("c1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<Array<{ id: string }>>(CURRENCY_KEY);
				expect(list?.some((c) => c.id === "c1")).toBe(false);
				expect(list?.some((c) => c.id === "c2")).toBe(true);
			});
			resolve?.({ id: "c1" });
		});
	});

	describe("addTransaction", () => {
		it("forwards the full payload including currencyId", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, []);
			trpcMocks.txCreate.mockResolvedValue({ id: "tx" });
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.addTransaction({
					amount: 1500,
					memo: "note",
					transactedAt: "2026-04-01",
					transactionTypeId: "type-1",
					currencyId: "c1",
				});
			});
			expect(trpcMocks.txCreate).toHaveBeenCalledWith({
				amount: 1500,
				memo: "note",
				transactedAt: "2026-04-01",
				transactionTypeId: "type-1",
				currencyId: "c1",
			});
		});

		it("the post-invalidate refetch reseeds all pages (no manual reset)", async () => {
			const seed = [
				{
					id: "tx1",
					amount: 100,
					transactionTypeName: "T",
					transactedAt: "2026-01-01",
				},
			];
			const refreshed = [
				...seed,
				{
					id: "tx-new",
					amount: 1,
					transactionTypeName: "T",
					transactedAt: "2026-04-01",
				},
			];
			trpcMocks.txListQueryFn
				.mockResolvedValueOnce({ items: seed, nextCursor: undefined })
				.mockResolvedValueOnce({ items: refreshed, nextCursor: undefined });
			trpcMocks.txCreate.mockResolvedValue({ id: "tx-new" });

			const qc = createClient();
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.allTransactions).toEqual(seed));
			await act(async () => {
				await result.current.addTransaction({
					amount: 1,
					transactedAt: "2026-04-01",
					transactionTypeId: "t",
					currencyId: "c1",
				});
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toEqual(refreshed)
			);
			expect(result.current.isFetchingNextPage).toBe(false);
		});
	});

	describe("editTransaction", () => {
		it("forwards the flat payload without the currencyId property", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, []);
			trpcMocks.txUpdate.mockResolvedValue({ id: "tx1" });
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.editTransaction({
					id: "tx1",
					amount: 200,
					memo: null,
					transactedAt: "2026-04-02",
					transactionTypeId: "type-2",
				});
			});
			expect(trpcMocks.txUpdate).toHaveBeenCalledWith({
				id: "tx1",
				amount: 200,
				memo: null,
				transactedAt: "2026-04-02",
				transactionTypeId: "type-2",
			});
		});

		it("optimistically patches the row in the infinite cache before the server resolves", async () => {
			const seed = [
				{
					id: "tx1",
					amount: 100,
					transactionTypeId: "old-type",
					transactionTypeName: "Old",
					transactedAt: "2026-01-01",
					memo: "before",
				},
				{
					id: "tx2",
					amount: 50,
					transactionTypeId: "other",
					transactionTypeName: "Other",
					transactedAt: "2026-01-02",
					memo: null,
				},
			];
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: seed,
				nextCursor: undefined,
			});
			const qc = createClient();
			// Block the server response so the assertion sees the optimistic
			// state, not the post-settle state.
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(2)
			);
			act(() => {
				result.current.editTransaction({
					id: "tx1",
					amount: 999,
					memo: "after",
					transactedAt: "2026-04-02",
					transactionTypeId: "new-type",
				});
			});
			await waitFor(() => {
				const patched = result.current.allTransactions.find(
					(t) => t.id === "tx1"
				);
				expect(patched).toMatchObject({
					id: "tx1",
					amount: 999,
					memo: "after",
					transactedAt: "2026-04-02",
					transactionTypeId: "new-type",
				});
			});
			// The optimistic write lives in the cache, not local state.
			const cached = qc.getQueryData<{
				pages: { items: TxRow[] }[];
			}>(txInfiniteKey("c1"));
			expect(cached?.pages[0]?.items.find((t) => t.id === "tx1")).toMatchObject(
				{ amount: 999 }
			);
			// untouched sibling row preserved.
			expect(
				result.current.allTransactions.find((t) => t.id === "tx2")
			).toMatchObject({ id: "tx2", amount: 50 });
			resolve?.({ id: "tx1" });
		});

		it("rolls the cache back to the pre-mutation snapshot when the server rejects", async () => {
			const original = [
				{
					id: "tx1",
					amount: 100,
					transactionTypeId: "old-type",
					transactionTypeName: "Old",
					transactedAt: "2026-01-01",
					memo: "before",
				},
			];
			// The onSettled invalidate triggers a refetch; mirror the rollback
			// state so the refetch reseeds with the same data the onError handler
			// restores (otherwise the assertion races the default empty queryFn).
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: original,
				nextCursor: undefined,
			});
			const qc = createClient();
			trpcMocks.txUpdate.mockRejectedValue(new Error("server down"));

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			await act(async () => {
				await expect(
					result.current.editTransaction({
						id: "tx1",
						amount: 999,
						memo: "after",
						transactedAt: "2026-04-02",
						transactionTypeId: "new-type",
					})
				).rejects.toThrow("server down");
			});
			// After onError, allTransactions matches the previous snapshot
			// (not the optimistic patch).
			expect(result.current.allTransactions[0]).toMatchObject({
				id: "tx1",
				amount: 100,
				memo: "before",
				transactedAt: "2026-01-01",
				transactionTypeId: "old-type",
			});
		});

		it("concurrent edits each capture their own pre-mutation snapshot (rollback of the failing edit does not undo the succeeding one)", async () => {
			const row = (amount: number) => ({
				id: "tx1",
				amount,
				transactionTypeId: "T",
				transactionTypeName: "T",
				transactedAt: "2026-01-01",
			});
			// Three observed refetches: initial (100), post-first-edit invalidate
			// (200), post-second-edit invalidate (200 again, since the rollback
			// target IS 200).
			trpcMocks.txListQueryFn
				.mockResolvedValueOnce({ items: [row(100)], nextCursor: undefined })
				.mockResolvedValueOnce({ items: [row(200)], nextCursor: undefined })
				.mockResolvedValueOnce({ items: [row(200)], nextCursor: undefined });
			const qc = createClient();
			// First call succeeds, second call rejects. Second rollback must
			// restore the snapshot taken AFTER the first optimistic patch — i.e.
			// it must not blow away the successful first edit.
			trpcMocks.txUpdate
				.mockResolvedValueOnce({ id: "tx1" })
				.mockRejectedValueOnce(new Error("net"));

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			await act(async () => {
				await result.current.editTransaction({
					id: "tx1",
					amount: 200,
					memo: null,
					transactedAt: "2026-01-01",
					transactionTypeId: "T",
				});
			});
			await waitFor(() =>
				expect(result.current.allTransactions[0]).toMatchObject({ amount: 200 })
			);
			await act(async () => {
				await expect(
					result.current.editTransaction({
						id: "tx1",
						amount: 300,
						memo: null,
						transactedAt: "2026-01-01",
						transactionTypeId: "T",
					})
				).rejects.toThrow("net");
			});
			// Rollback target = state right before the failing edit = 200,
			// not the original 100.
			await waitFor(() =>
				expect(result.current.allTransactions[0]).toMatchObject({ amount: 200 })
			);
		});
	});

	describe("deleteTransaction (optimistic on the infinite cache)", () => {
		it("optimistically removes the transaction from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 1,
								transactionTypeName: "a",
								transactedAt: "2026-01-01",
							},
							{
								id: "tx2",
								amount: 2,
								transactionTypeName: "b",
								transactedAt: "2026-01-02",
							},
						],
						nextCursor: undefined,
					},
				])
			);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(2)
			);
			act(() => {
				result.current.deleteTransaction("tx1");
			});
			// Optimistic cache filter happens in onMutate.
			await waitFor(() => {
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx2",
				]);
			});
			resolve?.({ id: "tx1" });
		});

		it("rolls the cache back to the pre-delete snapshot when the server rejects", async () => {
			const original = [
				{
					id: "tx1",
					amount: 1,
					transactionTypeName: "a",
					transactedAt: "2026-01-01",
				},
				{
					id: "tx2",
					amount: 2,
					transactionTypeName: "b",
					transactedAt: "2026-01-02",
				},
			];
			// Both the initial fetch and the post-error invalidation refetch
			// return the original rows — the assertion is "list matches pre-delete
			// state after the rollback".
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: original,
				nextCursor: undefined,
			});
			const qc = createClient();
			// Block the delete so the optimistic-remove state is observable
			// before the rejection rolls it back.
			let reject: ((reason: unknown) => void) | undefined;
			trpcMocks.txDelete.mockImplementation(
				() =>
					new Promise((_resolve, r) => {
						reject = r;
					})
			);

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(2)
			);
			act(() => {
				result.current.deleteTransaction("tx1");
			});
			// The optimistic remove kicks in while the delete is still in flight…
			await waitFor(() =>
				expect(result.current.allTransactions.map((t) => t.id)).toEqual(["tx2"])
			);
			// …and then onError rolls back to both rows once the rejection
			// propagates.
			reject?.(new Error("server down"));
			await waitFor(() =>
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx1",
					"tx2",
				])
			);
		});
	});

	describe("fetchNextPage", () => {
		it("no-ops when expandedCurrencyId is null", () => {
			const qc = createClient();
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.fetchNextPage();
			});
			expect(trpcMocks.txListQueryFn).not.toHaveBeenCalled();
		});

		it("no-ops when there is no next page (no cursor)", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 1,
								transactionTypeName: "a",
								transactedAt: "2026-01-01",
							},
						],
						nextCursor: undefined,
					},
				])
			);
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			act(() => {
				result.current.fetchNextPage();
			});
			expect(trpcMocks.txListQueryFn).not.toHaveBeenCalled();
		});

		it("fetches the next page with the last cursor and appends items", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 1,
								transactionTypeName: "a",
								transactedAt: "2026-01-01",
							},
						],
						nextCursor: "cursor-A",
					},
				])
			);
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: [
					{
						id: "tx2",
						amount: 2,
						transactionTypeName: "b",
						transactedAt: "2026-01-02",
					},
				],
				nextCursor: "cursor-B",
			});
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.hasNextPage).toBe(true));
			act(() => {
				result.current.fetchNextPage();
			});
			await waitFor(() =>
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx1",
					"tx2",
				])
			);
			expect(trpcMocks.txListQueryFn).toHaveBeenCalledWith({
				currencyId: "c1",
				cursor: "cursor-A",
			});
			expect(result.current.hasNextPage).toBe(true);
		});

		it("sets hasNextPage to false when the next page has no cursor", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 1,
								transactionTypeName: "a",
								transactedAt: "2026-01-01",
							},
						],
						nextCursor: "cursor-A",
					},
				])
			);
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: [],
				nextCursor: undefined,
			});
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.hasNextPage).toBe(true));
			act(() => {
				result.current.fetchNextPage();
			});
			await waitFor(() => expect(result.current.hasNextPage).toBe(false));
		});

		it("toggles isFetchingNextPage while the page is in flight", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 1,
								transactionTypeName: "a",
								transactedAt: "2026-01-01",
							},
						],
						nextCursor: "cursor-A",
					},
				])
			);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txListQueryFn.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.hasNextPage).toBe(true));
			act(() => {
				result.current.fetchNextPage();
			});
			await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
			resolve?.({ items: [], nextCursor: undefined });
			await waitFor(() =>
				expect(result.current.isFetchingNextPage).toBe(false)
			);
		});

		it("resets isFetchingNextPage and keeps the loaded page when the fetch errors", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 1,
								transactionTypeName: "a",
								transactedAt: "2026-01-01",
							},
						],
						nextCursor: "cursor-A",
					},
				])
			);
			trpcMocks.txListQueryFn.mockRejectedValue(new Error("network"));
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.hasNextPage).toBe(true));
			act(() => {
				result.current.fetchNextPage();
			});
			await waitFor(() =>
				expect(result.current.isFetchingNextPage).toBe(false)
			);
			expect(result.current.allTransactions.map((t) => t.id)).toEqual(["tx1"]);
		});

		it("is guarded against re-entry while a fetch is in flight", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([{ items: [], nextCursor: "cursor-A" }])
			);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txListQueryFn.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.hasNextPage).toBe(true));

			act(() => {
				result.current.fetchNextPage();
			});
			await waitFor(() => expect(result.current.isFetchingNextPage).toBe(true));
			act(() => {
				result.current.fetchNextPage();
			});
			expect(trpcMocks.txListQueryFn).toHaveBeenCalledTimes(1);

			resolve?.({ items: [], nextCursor: undefined });
			await waitFor(() =>
				expect(result.current.isFetchingNextPage).toBe(false)
			);
		});
	});

	describe("infinite cache survives refetch (regression for the rollback bug)", () => {
		it("keeps all loaded pages after an invalidate/refetch instead of collapsing to page 1", async () => {
			const page1 = [
				{
					id: "tx1",
					amount: 1,
					transactionTypeName: "a",
					transactedAt: "2026-01-01",
				},
			];
			const page2 = [
				{
					id: "tx2",
					amount: 2,
					transactionTypeName: "b",
					transactedAt: "2026-01-02",
				},
			];
			// cursor-aware queryFn so every page refetches correctly.
			trpcMocks.txListQueryFn.mockImplementation(
				({ cursor }: { cursor?: string }) =>
					cursor === "cursor-A"
						? Promise.resolve({ items: page2, nextCursor: undefined })
						: Promise.resolve({ items: page1, nextCursor: "cursor-A" })
			);
			const qc = createClient();
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});

			await waitFor(() =>
				expect(result.current.allTransactions.map((t) => t.id)).toEqual(["tx1"])
			);
			act(() => {
				result.current.fetchNextPage();
			});
			await waitFor(() =>
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx1",
					"tx2",
				])
			);

			// Simulate a focus / reconnect / addTransaction-driven refetch.
			await act(async () => {
				await qc.invalidateQueries({ queryKey: txInfiniteKey("c1") });
			});

			// Both pages survive — the bug would have collapsed this to ["tx1"].
			await waitFor(() =>
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx1",
					"tx2",
				])
			);
		});
	});

	describe("return shape", () => {
		it("exposes fetchNextPage and not the removed handleLoadMore / resetTransactionState", () => {
			const qc = createClient();
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			expect(typeof result.current.fetchNextPage).toBe("function");
			expect(
				(result.current as unknown as { handleLoadMore?: unknown })
					.handleLoadMore
			).toBeUndefined();
			expect(
				(result.current as unknown as { resetTransactionState?: unknown })
					.resetTransactionState
			).toBeUndefined();
		});
	});
});
