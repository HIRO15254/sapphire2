import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestQueryClient as createClient,
	withQueryClient as makeWrapper,
} from "@/__tests__/test-utils";

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
	currencyToggleFavorite: vi.fn(),
	// Per-test responses can hold refetch pending so rollback must stand alone.
	currencyListQueryFn: vi.fn(),
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
					queryFn: () => trpcMocks.currencyListQueryFn(),
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
			toggleFavorite: { mutate: trpcMocks.currencyToggleFavorite },
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

describe("useCurrencies", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		trpcMocks.currencyListQueryFn.mockResolvedValue([]);
		trpcMocks.txListQueryFn.mockResolvedValue({
			items: [],
			nextCursor: undefined,
		});
		trpcMocks.currencyToggleFavorite.mockResolvedValue({ id: "c1" });
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
						Array<{
							id: string;
							name: string;
							unit: string | null;
							isFavorite: boolean;
						}>
					>(CURRENCY_KEY);
				expect(list).toHaveLength(2);
				expect(list?.[1]?.name).toBe("Gold");
				expect(list?.[1]?.unit).toBe("g");
				expect(list?.[1]?.id).toMatch(TEMP_ID_PATTERN);
				expect(list?.[1]?.isFavorite).toBe(false);
			});
			resolve?.({ id: "c2" });
		});

		it("forwards the rich-text description and carries it on the temp row", async () => {
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
				result.current.create({ name: "Gold", description: "<p>shiny</p>" });
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<Array<{ id: string; description: string | null }>>(
						CURRENCY_KEY
					);
				expect(list?.[1]?.description).toBe("<p>shiny</p>");
			});
			expect(trpcMocks.currencyCreate).toHaveBeenCalledWith({
				name: "Gold",
				description: "<p>shiny</p>",
			});
			resolve?.({ id: "c2" });
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

		it("forwards the rich-text description to the update mutation", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: null, description: null },
			]);
			trpcMocks.currencyUpdate.mockResolvedValue({ id: "c1" });
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({
					id: "c1",
					name: "Chips",
					description: "<p>new</p>",
				});
			});
			expect(trpcMocks.currencyUpdate).toHaveBeenCalledWith({
				id: "c1",
				name: "Chips",
				unit: null,
				description: "<p>new</p>",
			});
		});

		it("sends an explicit null unit to the server when the unit is cleared", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: "$", description: null },
			]);
			trpcMocks.currencyUpdate.mockResolvedValue({ id: "c1" });
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({ id: "c1", name: "Chips" });
			});
			expect(trpcMocks.currencyUpdate).toHaveBeenCalledWith({
				id: "c1",
				name: "Chips",
				unit: null,
				description: undefined,
			});
		});

		it("forwards a set unit unchanged to the server", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{ id: "c1", name: "Chips", unit: null, description: null },
			]);
			trpcMocks.currencyUpdate.mockResolvedValue({ id: "c1" });
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({ id: "c1", name: "Chips", unit: "pt" });
			});
			expect(trpcMocks.currencyUpdate).toHaveBeenCalledWith({
				id: "c1",
				name: "Chips",
				unit: "pt",
				description: undefined,
			});
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

		it("toggles isAddTransactionPending across the mutation lifecycle", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.addTransaction({
					amount: 1,
					transactedAt: "2026-04-01",
					transactionTypeId: "t",
					currencyId: "c1",
				});
			});
			await waitFor(() =>
				expect(result.current.isAddTransactionPending).toBe(true)
			);
			resolve?.({ id: "tx-new" });
			await waitFor(() =>
				expect(result.current.isAddTransactionPending).toBe(false)
			);
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

		it("toggles isEditTransactionPending across the mutation lifecycle", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, []);
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
			act(() => {
				result.current.editTransaction({
					id: "tx1",
					amount: 1,
					memo: null,
					transactedAt: "2026-01-01",
					transactionTypeId: "t",
				});
			});
			await waitFor(() =>
				expect(result.current.isEditTransactionPending).toBe(true)
			);
			resolve?.({ id: "tx1" });
			await waitFor(() =>
				expect(result.current.isEditTransactionPending).toBe(false)
			);
		});

		it("optimistically patches a row that lives on a later page (multi-page cache)", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("c1"),
				seedPages([
					{
						items: [
							{
								id: "tx1",
								amount: 1,
								transactionTypeId: "t",
								transactionTypeName: "T",
								transactedAt: "2026-01-02",
								memo: null,
							},
						],
						nextCursor: "tx1",
					},
					{
						items: [
							{
								id: "tx2",
								amount: 2,
								transactionTypeId: "t",
								transactionTypeName: "T",
								transactedAt: "2026-01-01",
								memo: "before",
							},
						],
						nextCursor: undefined,
					},
				])
			);
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
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx1",
					"tx2",
				])
			);
			act(() => {
				result.current.editTransaction({
					id: "tx2",
					amount: 999,
					memo: "after",
					transactedAt: "2026-01-01",
					transactionTypeId: "t",
				});
			});
			await waitFor(() =>
				expect(
					result.current.allTransactions.find((t) => t.id === "tx2")
				).toMatchObject({ amount: 999, memo: "after" })
			);
			// The patch lands on page 2 of the cache; page 1 stays untouched.
			const cached = qc.getQueryData<{
				pages: { items: TxRow[] }[];
			}>(txInfiniteKey("c1"));
			expect(cached?.pages[1]?.items[0]).toMatchObject({
				id: "tx2",
				amount: 999,
			});
			expect(cached?.pages[0]?.items[0]).toMatchObject({
				id: "tx1",
				amount: 1,
			});
			resolve?.({ id: "tx2" });
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
			const refetch = Promise.withResolvers<{ items: TxRow[] }>();
			trpcMocks.txListQueryFn.mockReturnValue(refetch.promise);
			const qc = createClient();
			qc.setQueryData(txInfiniteKey("c1"), seedPages([{ items: original }]));
			const mutation = Promise.withResolvers<unknown>();
			trpcMocks.txUpdate.mockReturnValue(mutation.promise);

			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			let outcome: Promise<unknown>;
			act(() => {
				outcome = result.current
					.editTransaction({
						id: "tx1",
						amount: 999,
						memo: "after",
						transactedAt: "2026-04-02",
						transactionTypeId: "new-type",
					})
					.catch((error: unknown) => error);
			});
			await waitFor(() =>
				expect(result.current.allTransactions[0]?.amount).toBe(999)
			);
			await act(async () => {
				mutation.reject(new Error("server down"));
				expect(await outcome).toEqual(new Error("server down"));
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toEqual(original)
			);
			// The server has not returned the original row: only rollback can restore it.
			expect(qc.getQueryState(txInfiniteKey("c1"))?.fetchStatus).toBe(
				"fetching"
			);
			await act(async () => {
				refetch.resolve({ items: original });
				await refetch.promise;
			});
		});

		it.each([
			"first",
			"second",
		] as const)("keeps the other edit while the %s concurrent request fails before refetch", async (failedRequest) => {
			const original: TxRow[] = [
				{
					id: "tx1",
					amount: 100,
					transactionTypeName: "Deposit",
					transactedAt: "2026-01-01",
				},
				{
					id: "tx2",
					amount: 50,
					transactionTypeName: "Deposit",
					transactedAt: "2026-01-02",
				},
			];
			const first = Promise.withResolvers<unknown>();
			const second = Promise.withResolvers<unknown>();
			const refetch = Promise.withResolvers<{ items: TxRow[] }>();
			trpcMocks.txUpdate
				.mockReturnValueOnce(first.promise)
				.mockReturnValueOnce(second.promise);
			trpcMocks.txListQueryFn.mockReturnValue(refetch.promise);
			const qc = createClient();
			qc.setQueryData(txInfiniteKey("c1"), seedPages([{ items: original }]));
			const { result } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			const outcomes: Promise<unknown>[] = [];
			act(() => {
				outcomes.push(
					result.current
						.editTransaction({
							id: "tx1",
							amount: 200,
							memo: null,
							transactedAt: "2026-01-01",
							transactionTypeId: "T",
						})
						.catch((error: unknown) => error)
				);
			});
			await waitFor(() =>
				expect(result.current.allTransactions[0]?.amount).toBe(200)
			);
			act(() => {
				outcomes.push(
					result.current
						.editTransaction({
							id: "tx2",
							amount: 300,
							memo: null,
							transactedAt: "2026-01-02",
							transactionTypeId: "T",
						})
						.catch((error: unknown) => error)
				);
			});
			await waitFor(() => expect(trpcMocks.txUpdate).toHaveBeenCalledTimes(2));
			expect(qc.isMutating()).toBe(2);
			expect(result.current.allTransactions.map((row) => row.amount)).toEqual([
				200, 300,
			]);
			await act(async () => {
				(failedRequest === "first" ? first : second).reject(
					new Error("rejected")
				);
				await outcomes[failedRequest === "first" ? 0 : 1];
			});
			const expectedAmounts =
				failedRequest === "first" ? [100, 300] : [200, 50];
			await waitFor(() =>
				expect(result.current.allTransactions.map((row) => row.amount)).toEqual(
					expectedAmounts
				)
			);
			expect(qc.isMutating()).toBe(1);
			// Refetching now could replace the other request's optimistic row with stale data.
			expect(trpcMocks.txListQueryFn).not.toHaveBeenCalled();
			await act(async () => {
				(failedRequest === "first" ? second : first).resolve({ id: "saved" });
				await Promise.all(outcomes);
			});
			await waitFor(() =>
				expect(trpcMocks.txListQueryFn).toHaveBeenCalledTimes(1)
			);
			expect(result.current.allTransactions.map((row) => row.amount)).toEqual(
				expectedAmounts
			);
			await act(async () => {
				refetch.resolve({
					items: original.map((row, index) => ({
						...row,
						amount: expectedAmounts[index] ?? 0,
					})),
				});
				await refetch.promise;
			});
		});
	});

	describe("create with another pending transaction mutation", () => {
		it.each([
			{ operation: "edit", first: "create", createFails: false },
			{ operation: "edit", first: "existing", createFails: false },
			{ operation: "delete", first: "create", createFails: false },
			{ operation: "delete", first: "existing", createFails: false },
			{ operation: "edit", first: "create", createFails: true },
		] as const)("waits for $operation and create when $first settles first (create rejected: $createFails)", async ({
			operation,
			first,
			createFails,
		}) => {
			const original: TxRow[] = [
				{
					id: "tx1",
					amount: 100,
					transactionTypeName: "Deposit",
					transactedAt: "2026-01-01",
				},
			];
			const creating = Promise.withResolvers<unknown>();
			const changing = Promise.withResolvers<unknown>();
			const refetch = Promise.withResolvers<{ items: TxRow[] }>();
			trpcMocks.txCreate.mockReturnValue(creating.promise);
			trpcMocks.txUpdate.mockReturnValue(changing.promise);
			trpcMocks.txDelete.mockReturnValue(changing.promise);
			trpcMocks.txListQueryFn.mockReturnValue(refetch.promise);
			const qc = createClient();
			qc.setQueryData(txInfiniteKey("c1"), seedPages([{ items: original }]));
			const { result, unmount } = renderHook(() => useCurrencies("c1"), {
				wrapper: makeWrapper(qc),
			});
			const outcomes: Promise<unknown>[] = [];
			act(() => {
				if (operation === "edit") {
					outcomes.push(
						result.current
							.editTransaction({
								id: "tx1",
								amount: 200,
								memo: null,
								transactionTypeId: "T",
								transactedAt: "2026-01-01",
							})
							.catch((error: unknown) => error)
					);
				} else {
					result.current.deleteTransaction("tx1");
				}
			});
			await waitFor(() =>
				expect(result.current.allTransactions.map((row) => row.amount)).toEqual(
					operation === "edit" ? [200] : []
				)
			);
			act(() => {
				outcomes.push(
					result.current
						.addTransaction({
							currencyId: "c1",
							amount: 50,
							transactionTypeId: "T",
							transactedAt: "2026-01-02",
						})
						.catch((error: unknown) => error)
				);
			});
			await waitFor(() => expect(trpcMocks.txCreate).toHaveBeenCalledTimes(1));
			expect(qc.isMutating()).toBe(2);
			act(() => {
				if (first === "existing") {
					changing.reject(new Error("existing rejected"));
				} else if (createFails) {
					creating.reject(new Error("create rejected"));
				} else {
					creating.resolve({ id: "created" });
				}
			});
			await waitFor(() => expect(qc.isMutating()).toBe(1));
			expect(trpcMocks.txListQueryFn).not.toHaveBeenCalled();
			const pendingAmounts = operation === "edit" ? [200] : [];
			expect(result.current.allTransactions.map((row) => row.amount)).toEqual(
				first === "existing" ? [100] : pendingAmounts
			);
			await act(async () => {
				if (first === "existing") {
					creating.resolve({ id: "created" });
				} else {
					changing.reject(new Error("existing rejected"));
				}
				await Promise.all(outcomes);
			});
			await waitFor(() => expect(qc.isMutating()).toBe(0));
			expect(trpcMocks.txListQueryFn).toHaveBeenCalledTimes(1);
			await waitFor(() =>
				expect(result.current.allTransactions).toEqual(original)
			);
			const returned = createFails
				? original
				: [
						...original,
						{
							id: "created",
							amount: 50,
							transactionTypeName: "Deposit",
							transactedAt: "2026-01-02",
						},
					];
			await act(async () => {
				refetch.resolve({ items: returned });
				await refetch.promise;
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toEqual(returned)
			);
			unmount();
			qc.clear();
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
			const refetch = Promise.withResolvers<{ items: TxRow[] }>();
			trpcMocks.txListQueryFn.mockReturnValue(refetch.promise);
			const qc = createClient();
			qc.setQueryData(txInfiniteKey("c1"), seedPages([{ items: original }]));
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
				expect(result.current.allTransactions).toEqual(original)
			);
			expect(qc.getQueryState(txInfiniteKey("c1"))?.fetchStatus).toBe(
				"fetching"
			);
			await act(async () => {
				refetch.resolve({ items: original });
				await refetch.promise;
			});
		});

		it("removes a row that lives on a later page, leaving page 1 intact (multi-page cache)", async () => {
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
								transactedAt: "2026-01-02",
							},
						],
						nextCursor: "tx1",
					},
					{
						items: [
							{
								id: "tx2",
								amount: 2,
								transactionTypeName: "b",
								transactedAt: "2026-01-01",
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
				expect(result.current.allTransactions.map((t) => t.id)).toEqual([
					"tx1",
					"tx2",
				])
			);
			act(() => {
				result.current.deleteTransaction("tx2");
			});
			// Only tx2 (page 2) is removed; the page envelope is preserved.
			await waitFor(() =>
				expect(result.current.allTransactions.map((t) => t.id)).toEqual(["tx1"])
			);
			const cached = qc.getQueryData<{
				pages: { items: TxRow[] }[];
			}>(txInfiniteKey("c1"));
			expect(cached?.pages).toHaveLength(2);
			expect(cached?.pages[1]?.items).toEqual([]);
			resolve?.({ id: "tx2" });
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

	describe("toggleFavorite (楽観的更新)", () => {
		it("flips isFavorite from false to true in the cache immediately", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{
					id: "c1",
					name: "Chips",
					unit: null,
					balance: 0,
					isFavorite: false,
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyToggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("c1");
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<Array<{ id: string; isFavorite: boolean }>>(
						CURRENCY_KEY
					);
				expect(list?.[0]?.isFavorite).toBe(true);
			});
			resolve?.({ id: "c1" });
		});

		it("flips isFavorite from true to false in the cache immediately", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{
					id: "c1",
					name: "Chips",
					unit: null,
					balance: 0,
					isFavorite: true,
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyToggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("c1");
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<Array<{ id: string; isFavorite: boolean }>>(
						CURRENCY_KEY
					);
				expect(list?.[0]?.isFavorite).toBe(false);
			});
			resolve?.({ id: "c1" });
		});

		it("rolls back to the pre-toggle state when the server rejects", async () => {
			const original = [
				{
					id: "c1",
					name: "Chips",
					unit: null,
					balance: 0,
					isFavorite: false,
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			];
			const refetch = Promise.withResolvers<typeof original>();
			trpcMocks.currencyListQueryFn.mockReturnValue(refetch.promise);
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, original);
			const mutation = Promise.withResolvers<unknown>();
			trpcMocks.currencyToggleFavorite.mockReturnValue(mutation.promise);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			let outcome: Promise<unknown>;
			act(() => {
				outcome = result.current
					.toggleFavorite("c1")
					.catch((error: unknown) => error);
			});
			await waitFor(() =>
				expect(result.current.currencies[0]?.isFavorite).toBe(true)
			);
			await act(async () => {
				mutation.reject(new Error("server error"));
				expect(await outcome).toEqual(new Error("server error"));
			});
			await waitFor(() =>
				expect(result.current.currencies[0]?.isFavorite).toBe(false)
			);
			expect(qc.getQueryState(CURRENCY_KEY)?.fetchStatus).toBe("fetching");
			await act(async () => {
				refetch.resolve(original);
				await refetch.promise;
			});
		});

		it("isToggleFavoritePending flips true during in-flight mutation", async () => {
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{
					id: "c1",
					name: "Chips",
					unit: null,
					balance: 0,
					isFavorite: false,
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyToggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("c1");
			});
			await waitFor(() =>
				expect(result.current.isToggleFavoritePending).toBe(true)
			);
			resolve?.({ id: "c1" });
			await waitFor(() =>
				expect(result.current.isToggleFavoritePending).toBe(false)
			);
		});

		it("places favorited currency at its createdAt position among existing favorites", async () => {
			// c2 (T3) was non-fav, chronologically between c1(T1) and c3(T4).
			// After favoriting, sort should interleave it: [c1, c2, c3].
			// A naive "always move to front/end" or stable sort would give [c1, c3, c2].
			const T1 = "2024-01-01T00:00:00.000Z";
			const T3 = "2024-03-01T00:00:00.000Z";
			const T4 = "2024-04-01T00:00:00.000Z";
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{
					id: "c1",
					name: "Alpha",
					unit: null,
					balance: 0,
					isFavorite: true,
					createdAt: T1,
				},
				{
					id: "c3",
					name: "Gamma",
					unit: null,
					balance: 0,
					isFavorite: true,
					createdAt: T4,
				},
				{
					id: "c2",
					name: "Beta",
					unit: null,
					balance: 0,
					isFavorite: false,
					createdAt: T3,
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyToggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("c2");
			});
			await waitFor(() => {
				expect(result.current.currencies.map((c) => c.id)).toEqual([
					"c1",
					"c2",
					"c3",
				]);
			});
			resolve?.({ id: "c2" });
		});

		it("places un-favorited currency at its createdAt position among non-favorites", async () => {
			// c1 (T2) was fav, chronologically between c2(T1) and c3(T3).
			// After un-favoriting, sort should interleave it: [c2, c1, c3].
			// A stable sort would keep c1 before c2 since it was first in the array.
			const T1 = "2024-01-01T00:00:00.000Z";
			const T2 = "2024-02-01T00:00:00.000Z";
			const T3 = "2024-03-01T00:00:00.000Z";
			const qc = createClient();
			qc.setQueryData(CURRENCY_KEY, [
				{
					id: "c1",
					name: "Fav",
					unit: null,
					balance: 0,
					isFavorite: true,
					createdAt: T2,
				},
				{
					id: "c2",
					name: "Old",
					unit: null,
					balance: 0,
					isFavorite: false,
					createdAt: T1,
				},
				{
					id: "c3",
					name: "New",
					unit: null,
					balance: 0,
					isFavorite: false,
					createdAt: T3,
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.currencyToggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useCurrencies(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("c1");
			});
			await waitFor(() => {
				expect(result.current.currencies.map((c) => c.id)).toEqual([
					"c2",
					"c1",
					"c3",
				]);
			});
			resolve?.({ id: "c1" });
		});
	});
});
