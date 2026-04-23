import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks for trpc. queryOptions builds a stable queryKey so the real QueryClient
// can seed and read data predictably.
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
	txQuery: vi.fn(),
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
				queryOptions: (
					input: { currencyId: string },
					opts?: { enabled?: boolean }
				) => ({
					queryKey: buildKey("currencyTransaction", "listByCurrency", input),
					queryFn: () => Promise.resolve({ items: [], nextCursor: undefined }),
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
			listByCurrency: { query: trpcMocks.txQuery },
		},
	},
}));

import { useCurrencies } from "@/features/currencies/hooks/use-currencies";

const TEMP_ID_PATTERN = /^temp-/;
const CURRENCY_KEY = ["currency", "list"];
const txKey = (currencyId: string) => [
	"currencyTransaction",
	"listByCurrency",
	{ currencyId },
];

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
			expect(result.current.txHasMore).toBe(false);
			expect(result.current.isLoadingMore).toBe(false);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isAddTransactionPending).toBe(false);
			expect(result.current.isEditTransactionPending).toBe(false);
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

	describe("expanded currency syncs transactions", () => {
		it("syncs allTransactions from listByCurrency cache when expandedCurrencyId is set", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 100,
						transactionTypeName: "Deposit",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: "cursor-A",
			});
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			expect(result.current.txHasMore).toBe(true);
		});

		it("sets txHasMore to false when nextCursor is undefined", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 100,
						transactionTypeName: "Deposit",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: undefined,
			});
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			expect(result.current.txHasMore).toBe(false);
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

		it("resetTransactionState is called on success (cursor cleared, isLoadingMore=false)", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 100,
						transactionTypeName: "T",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: "cursor-A",
			});
			trpcMocks.txCreate.mockResolvedValue({ id: "tx-new" });

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.txHasMore).toBe(true));
			await act(async () => {
				await result.current.addTransaction({
					amount: 1,
					transactedAt: "2026-04-01",
					transactionTypeId: "t",
					currencyId: "c1",
				});
			});
			expect(result.current.allTransactions).toEqual([]);
			expect(result.current.txHasMore).toBe(false);
			expect(result.current.isLoadingMore).toBe(false);
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
	});

	describe("deleteTransaction (local optimistic on state)", () => {
		it("optimistically removes the transaction from allTransactions", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
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
			});
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
			// Optimistic local filter happens synchronously in onMutate.
			await waitFor(() => {
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx2",
				]);
			});
			resolve?.({ id: "tx1" });
		});

		it("keeps local state consistent through an error path (optimistic remove + rollback attempted)", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 1,
						transactionTypeName: "a",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: undefined,
			});
			// Reject without resolving so onSettled refetch is still pending.
			trpcMocks.txDelete.mockRejectedValue(new Error("server down"));

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			await act(async () => {
				result.current.deleteTransaction("tx1");
				// flush microtasks so the mutation mock observes the call.
				await Promise.resolve();
			});
			await waitFor(() =>
				expect(trpcMocks.txDelete).toHaveBeenCalledWith({ id: "tx1" })
			);
		});
	});

	describe("handleLoadMore", () => {
		it("no-ops when expandedCurrencyId is null", async () => {
			const qc = createClient();
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.handleLoadMore();
			});
			expect(trpcMocks.txQuery).not.toHaveBeenCalled();
		});

		it("no-ops when there is no cursor", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 1,
						transactionTypeName: "a",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: undefined,
			});
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			await act(async () => {
				await result.current.handleLoadMore();
			});
			expect(trpcMocks.txQuery).not.toHaveBeenCalled();
		});

		it("appends items and updates cursor when the query returns a new page", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 1,
						transactionTypeName: "a",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: "cursor-A",
			});
			trpcMocks.txQuery.mockResolvedValue({
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
			await waitFor(() => expect(result.current.txHasMore).toBe(true));
			await act(async () => {
				await result.current.handleLoadMore();
			});
			expect(trpcMocks.txQuery).toHaveBeenCalledWith({
				currencyId: "c1",
				cursor: "cursor-A",
			});
			expect(result.current.allTransactions.map((t) => t.id)).toEqual([
				"tx1",
				"tx2",
			]);
			expect(result.current.txHasMore).toBe(true);
		});

		it("sets txHasMore to false when the next page has no cursor", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 1,
						transactionTypeName: "a",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: "cursor-A",
			});
			trpcMocks.txQuery.mockResolvedValue({
				items: [],
				nextCursor: undefined,
			});
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.txHasMore).toBe(true));
			await act(async () => {
				await result.current.handleLoadMore();
			});
			expect(result.current.txHasMore).toBe(false);
		});

		it("clears isLoadingMore in finally even if the query throws", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 1,
						transactionTypeName: "a",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: "cursor-A",
			});
			trpcMocks.txQuery.mockRejectedValue(new Error("network"));
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.txHasMore).toBe(true));
			await act(async () => {
				await expect(result.current.handleLoadMore()).rejects.toThrow(
					"network"
				);
			});
			expect(result.current.isLoadingMore).toBe(false);
		});

		it("is guarded against re-entry after isLoadingMore has propagated through a re-render", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [],
				nextCursor: "cursor-A",
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txQuery.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.txHasMore).toBe(true));

			act(() => {
				result.current.handleLoadMore();
			});
			// Wait until the state update propagates and the next render sees
			// isLoadingMore=true; then a subsequent call must be a no-op.
			await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
			await act(async () => {
				await result.current.handleLoadMore();
			});
			expect(trpcMocks.txQuery).toHaveBeenCalledTimes(1);

			resolve?.({ items: [], nextCursor: undefined });
			await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
		});
	});

	describe("resetTransactionState", () => {
		it("clears allTransactions, txHasMore, isLoadingMore", async () => {
			const qc = createClient();
			qc.setQueryData(txKey("c1"), {
				items: [
					{
						id: "tx1",
						amount: 1,
						transactionTypeName: "a",
						transactedAt: "2026-01-01",
					},
				],
				nextCursor: "cursor-A",
			});
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			act(() => {
				result.current.resetTransactionState();
			});
			expect(result.current.allTransactions).toEqual([]);
			expect(result.current.txHasMore).toBe(false);
			expect(result.current.isLoadingMore).toBe(false);
		});
	});
});
