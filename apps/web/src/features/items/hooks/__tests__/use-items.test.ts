import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks for trpc. infiniteQueryOptions builds a stable queryKey + a queryFn
// that forwards { itemId, cursor } to txListQueryFn, so the real QueryClient
// can drive useInfiniteQuery, seed pages, and refetch predictably.
// ---------------------------------------------------------------------------

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	itemCreate: vi.fn(),
	itemUpdate: vi.fn(),
	itemDelete: vi.fn(),
	// queryFn used by useQuery(item.list). Per-test override controls refetch
	// payloads (needed for rollback assertions that survive the onSettled refetch).
	itemListQueryFn: vi.fn(),
	txCreate: vi.fn(),
	txUpdate: vi.fn(),
	txDelete: vi.fn(),
	// queryFn used by useInfiniteQuery(listByItem). Called with
	// { itemId, cursor } per page; per-test override controls each page /
	// refetch payload.
	txListQueryFn: vi.fn(),
}));

const optimisticMocks = vi.hoisted(() => ({ updateQueryItems: vi.fn() }));

vi.mock("@/utils/optimistic-update", async () => {
	const actual = await vi.importActual<
		typeof import("@/utils/optimistic-update")
	>("@/utils/optimistic-update");
	return {
		...actual,
		updateQueryItems: vi.fn(
			(...args: Parameters<typeof actual.updateQueryItems>) => {
				optimisticMocks.updateQueryItems(...args);
				return actual.updateQueryItems(...args);
			}
		),
	};
});
vi.mock("@/utils/trpc", () => ({
	trpc: {
		item: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("item", "list", undefined),
					queryFn: () => trpcMocks.itemListQueryFn(),
				}),
			},
		},
		itemTransaction: {
			listByItem: {
				infiniteQueryOptions: (
					input: { itemId: string },
					opts?: {
						enabled?: boolean;
						getNextPageParam?: (lastPage: {
							items: unknown[];
							nextCursor?: string;
						}) => string | undefined;
						initialCursor?: string;
					}
				) => ({
					queryKey: buildKey("itemTransaction", "listByItem", {
						itemId: input.itemId,
						type: "infinite",
					}),
					queryFn: ({ pageParam }: { pageParam?: string }) =>
						trpcMocks.txListQueryFn({
							itemId: input.itemId,
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
		item: {
			create: { mutate: trpcMocks.itemCreate },
			update: { mutate: trpcMocks.itemUpdate },
			delete: { mutate: trpcMocks.itemDelete },
		},
		itemTransaction: {
			create: { mutate: trpcMocks.txCreate },
			update: { mutate: trpcMocks.txUpdate },
			delete: { mutate: trpcMocks.txDelete },
		},
	},
}));

import { useItems } from "@/features/items/hooks/use-items";

const TEMP_ID_PATTERN = /^temp-/;
const ITEM_KEY = ["item", "list"];
const txInfiniteKey = (itemId: string) => [
	"itemTransaction",
	"listByItem",
	{ itemId, type: "infinite" },
];

interface TxRow {
	count: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	sessionName?: string | null;
	transactedAt: string;
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

const baseItem = {
	id: "i1",
	name: "Ticket",
	currencyId: "c1",
	currencyName: "USD",
	currencyUnit: "$",
	unitValue: 100,
	description: null as string | null,
	holdings: 3,
	createdAt: "2024-01-01T00:00:00.000Z",
};

describe("useItems", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		trpcMocks.itemListQueryFn.mockResolvedValue([]);
		trpcMocks.txListQueryFn.mockResolvedValue({
			items: [],
			nextCursor: undefined,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns empty items and no transactions when no cache seeded and expandedItemId is null", () => {
			const qc = createClient();
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.items).toEqual([]);
			expect(result.current.allTransactions).toEqual([]);
			expect(result.current.hasNextPage).toBe(false);
			expect(result.current.isFetchingNextPage).toBe(false);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isAddTransactionPending).toBe(false);
			expect(result.current.isEditTransactionPending).toBe(false);
		});

		it("does not fetch transactions when expandedItemId is null (query disabled)", () => {
			const qc = createClient();
			renderHook(() => useItems(null), { wrapper: makeWrapper(qc) });
			expect(trpcMocks.txListQueryFn).not.toHaveBeenCalled();
		});

		it("defaults expandedItemId to null when called without arguments (list-only consumers)", () => {
			const qc = createClient();
			const { result } = renderHook(() => useItems(), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.items).toEqual([]);
			expect(trpcMocks.txListQueryFn).not.toHaveBeenCalled();
		});

		it("exposes items seeded into the cache", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [
				baseItem,
				{ ...baseItem, id: "i2", name: "Voucher" },
			]);
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.items).toHaveLength(2));
		});
	});

	describe("expanded item loads transactions", () => {
		it("flattens all pages into allTransactions and reflects a next cursor", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 2, transactedAt: "2026-01-01" }],
						nextCursor: "cursor-A",
					},
				])
			);
			const { result } = renderHook(() => useItems("i1"), {
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
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 2, transactedAt: "2026-01-01" }],
						nextCursor: undefined,
					},
				])
			);
			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			expect(result.current.hasNextPage).toBe(false);
		});

		it("fetches page 1 via the queryFn with no cursor when nothing is seeded", async () => {
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }],
				nextCursor: undefined,
			});
			const qc = createClient();
			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			expect(trpcMocks.txListQueryFn).toHaveBeenCalledWith({
				itemId: "i1",
				cursor: undefined,
			});
		});
	});

	describe("create (optimistic)", () => {
		it("uses the shared list helper for item list updates", async () => {
			const callsBefore = optimisticMocks.updateQueryItems.mock.calls.length;
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [baseItem]);
			trpcMocks.itemCreate.mockResolvedValue({ id: "i2" });
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({
					name: "Voucher",
					currencyId: "c1",
					unitValue: 500,
				});
			});
			expect(optimisticMocks.updateQueryItems).toHaveBeenCalledTimes(
				callsBefore + 1
			);
			expect(optimisticMocks.updateQueryItems).toHaveBeenNthCalledWith(
				callsBefore + 1,
				qc,
				ITEM_KEY,
				expect.any(Function)
			);
		});

		it("optimistically appends a temp item entry with zero holdings during mutation", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [baseItem]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.itemCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});

			act(() => {
				result.current.create({
					name: "Voucher",
					currencyId: "c9",
					unitValue: 500,
				});
			});

			await waitFor(() => {
				const list =
					qc.getQueryData<
						Array<{
							currencyId: string;
							holdings: number;
							id: string;
							name: string;
							unitValue: number;
						}>
					>(ITEM_KEY);
				expect(list).toHaveLength(2);
				expect(list?.[1]?.name).toBe("Voucher");
				expect(list?.[1]?.currencyId).toBe("c9");
				expect(list?.[1]?.unitValue).toBe(500);
				expect(list?.[1]?.holdings).toBe(0);
				expect(list?.[1]?.id).toMatch(TEMP_ID_PATTERN);
			});
			resolve?.({ id: "i2" });
		});

		it("forwards the create payload without a description when omitted", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [baseItem]);
			trpcMocks.itemCreate.mockResolvedValue({ id: "new" });
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({
					name: "Plain",
					currencyId: "c1",
					unitValue: 0,
				});
			});
			expect(trpcMocks.itemCreate).toHaveBeenCalledWith({
				name: "Plain",
				currencyId: "c1",
				unitValue: 0,
			});
		});

		it("forwards the rich-text description and carries it on the temp row", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [baseItem]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.itemCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({
					name: "Voucher",
					currencyId: "c1",
					unitValue: 1,
					description: "<p>notes</p>",
				});
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<Array<{ description: string | null; id: string }>>(
						ITEM_KEY
					);
				expect(list?.[1]?.description).toBe("<p>notes</p>");
			});
			expect(trpcMocks.itemCreate).toHaveBeenCalledWith({
				name: "Voucher",
				currencyId: "c1",
				unitValue: 1,
				description: "<p>notes</p>",
			});
			resolve?.({ id: "i2" });
		});

		it("onMutate: no-op when cache is undefined (old === undefined)", async () => {
			const qc = createClient();
			trpcMocks.itemCreate.mockResolvedValue({ id: "new" });
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({
					name: "Free",
					currencyId: "c1",
					unitValue: 0,
				});
			});
			// The onMutate branch returns old unchanged; no throw.
			expect(trpcMocks.itemCreate).toHaveBeenCalledTimes(1);
			expect(trpcMocks.itemCreate).toHaveBeenCalledWith({
				name: "Free",
				currencyId: "c1",
				unitValue: 0,
			});
		});

		it("isCreatePending flips true during in-flight mutation", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.itemCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({ name: "T", currencyId: "c1", unitValue: 1 });
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolve?.({ id: "new" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));
		});

		it("rolls the list back to the pre-create snapshot when the server rejects", async () => {
			const original = [baseItem];
			trpcMocks.itemListQueryFn.mockResolvedValue(original);
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, original);
			trpcMocks.itemCreate.mockRejectedValue(new Error("server down"));
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(
					result.current.create({
						name: "Doomed",
						currencyId: "c1",
						unitValue: 1,
					})
				).rejects.toThrow("server down");
			});
			await waitFor(() => expect(result.current.items).toHaveLength(1));
			expect(result.current.items[0]?.id).toBe("i1");
		});
	});

	describe("update (optimistic)", () => {
		it("optimistically patches the matching item", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [
				baseItem,
				{ ...baseItem, id: "i2", name: "Voucher" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.itemUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({
					id: "i1",
					name: "Renamed",
					currencyId: "c1",
					unitValue: 999,
				});
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<
						Array<{ id: string; name: string; unitValue: number }>
					>(ITEM_KEY);
				expect(list?.[0]?.name).toBe("Renamed");
				expect(list?.[0]?.unitValue).toBe(999);
				expect(list?.[1]?.name).toBe("Voucher");
			});
			resolve?.({ id: "i1" });
		});

		it("forwards the full update payload including the description", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [baseItem]);
			trpcMocks.itemUpdate.mockResolvedValue({ id: "i1" });
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({
					id: "i1",
					name: "Ticket",
					currencyId: "c2",
					unitValue: 200,
					description: "<p>new</p>",
				});
			});
			expect(trpcMocks.itemUpdate).toHaveBeenCalledWith({
				id: "i1",
				name: "Ticket",
				currencyId: "c2",
				unitValue: 200,
				description: "<p>new</p>",
			});
		});

		it("rolls back the optimistic patch when the server rejects", async () => {
			const original = [baseItem];
			trpcMocks.itemListQueryFn.mockResolvedValue(original);
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, original);
			trpcMocks.itemUpdate.mockRejectedValue(new Error("nope"));
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(
					result.current.update({
						id: "i1",
						name: "Broken",
						currencyId: "c1",
						unitValue: 5,
					})
				).rejects.toThrow("nope");
			});
			await waitFor(() =>
				expect(result.current.items[0]).toMatchObject({
					id: "i1",
					name: "Ticket",
					unitValue: 100,
				})
			);
		});
	});

	describe("delete (optimistic)", () => {
		it("optimistically removes the item from the list", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, [
				baseItem,
				{ ...baseItem, id: "i2", name: "Voucher" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.itemDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.delete("i1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<Array<{ id: string }>>(ITEM_KEY);
				expect(list?.some((i) => i.id === "i1")).toBe(false);
				expect(list?.some((i) => i.id === "i2")).toBe(true);
			});
			resolve?.({ success: true });
		});

		it("restores the item when the server rejects with CONFLICT (item has transactions)", async () => {
			const original = [baseItem];
			trpcMocks.itemListQueryFn.mockResolvedValue(original);
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, original);
			trpcMocks.itemDelete.mockRejectedValue(
				new Error("Item cannot be deleted while it has transactions")
			);
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(result.current.delete("i1")).rejects.toThrow(
					"Item cannot be deleted while it has transactions"
				);
			});
			await waitFor(() =>
				expect(result.current.items.map((i) => i.id)).toEqual(["i1"])
			);
		});
	});

	describe("addTransaction", () => {
		it("forwards the full payload including itemId", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, []);
			trpcMocks.txCreate.mockResolvedValue({ id: "tx" });
			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.addTransaction({
					count: 2,
					memo: "note",
					transactedAt: "2026-04-01",
					itemId: "i1",
				});
			});
			expect(trpcMocks.txCreate).toHaveBeenCalledWith({
				count: 2,
				memo: "note",
				transactedAt: "2026-04-01",
				itemId: "i1",
			});
		});

		it("the post-invalidate refetch reseeds all pages (no manual reset)", async () => {
			const seed = [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }];
			const refreshed = [
				...seed,
				{ id: "tx-new", count: -1, transactedAt: "2026-04-01" },
			];
			trpcMocks.txListQueryFn
				.mockResolvedValueOnce({ items: seed, nextCursor: undefined })
				.mockResolvedValueOnce({ items: refreshed, nextCursor: undefined });
			trpcMocks.txCreate.mockResolvedValue({ id: "tx-new" });

			const qc = createClient();
			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.allTransactions).toEqual(seed));
			await act(async () => {
				await result.current.addTransaction({
					count: -1,
					transactedAt: "2026-04-01",
					itemId: "i1",
				});
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toEqual(refreshed)
			);
			expect(result.current.isFetchingNextPage).toBe(false);
		});

		it("toggles isAddTransactionPending across the mutation lifecycle", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.addTransaction({
					count: 1,
					transactedAt: "2026-04-01",
					itemId: "i1",
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
		it("forwards the flat payload without the itemId property", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, []);
			trpcMocks.txUpdate.mockResolvedValue({ id: "tx1" });
			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.editTransaction({
					id: "tx1",
					count: -2,
					memo: null,
					transactedAt: "2026-04-02",
				});
			});
			expect(trpcMocks.txUpdate).toHaveBeenCalledWith({
				id: "tx1",
				count: -2,
				memo: null,
				transactedAt: "2026-04-02",
			});
		});

		it("toggles isEditTransactionPending across the mutation lifecycle", async () => {
			const qc = createClient();
			qc.setQueryData(ITEM_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.editTransaction({
					id: "tx1",
					count: 1,
					memo: null,
					transactedAt: "2026-01-01",
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
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [
							{ id: "tx1", count: 1, transactedAt: "2026-01-02", memo: null },
						],
						nextCursor: "tx1",
					},
					{
						items: [
							{
								id: "tx2",
								count: 2,
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

			const { result } = renderHook(() => useItems("i1"), {
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
					count: -9,
					memo: "after",
					transactedAt: "2026-01-01",
				});
			});
			await waitFor(() =>
				expect(
					result.current.allTransactions.find((t) => t.id === "tx2")
				).toMatchObject({ count: -9, memo: "after" })
			);
			// The patch lands on page 2 of the cache; page 1 stays untouched.
			const cached = qc.getQueryData<{
				pages: { items: TxRow[] }[];
			}>(txInfiniteKey("i1"));
			expect(cached?.pages[1]?.items[0]).toMatchObject({
				id: "tx2",
				count: -9,
			});
			expect(cached?.pages[0]?.items[0]).toMatchObject({
				id: "tx1",
				count: 1,
			});
			resolve?.({ id: "tx2" });
		});

		it("optimistically patches the row in the infinite cache before the server resolves", async () => {
			const seed = [
				{ id: "tx1", count: 3, transactedAt: "2026-01-01", memo: "before" },
				{ id: "tx2", count: -1, transactedAt: "2026-01-02", memo: null },
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

			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(2)
			);
			act(() => {
				result.current.editTransaction({
					id: "tx1",
					count: 9,
					memo: "after",
					transactedAt: "2026-04-02",
				});
			});
			await waitFor(() => {
				const patched = result.current.allTransactions.find(
					(t) => t.id === "tx1"
				);
				expect(patched).toMatchObject({
					id: "tx1",
					count: 9,
					memo: "after",
					transactedAt: "2026-04-02",
				});
			});
			// The optimistic write lives in the cache, not local state.
			const cached = qc.getQueryData<{
				pages: { items: TxRow[] }[];
			}>(txInfiniteKey("i1"));
			expect(cached?.pages[0]?.items.find((t) => t.id === "tx1")).toMatchObject(
				{ count: 9 }
			);
			// untouched sibling row preserved.
			expect(
				result.current.allTransactions.find((t) => t.id === "tx2")
			).toMatchObject({ id: "tx2", count: -1 });
			resolve?.({ id: "tx1" });
		});

		it("rolls the cache back to the pre-mutation snapshot when the server rejects", async () => {
			const original = [
				{ id: "tx1", count: 3, transactedAt: "2026-01-01", memo: "before" },
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

			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			await act(async () => {
				await expect(
					result.current.editTransaction({
						id: "tx1",
						count: 9,
						memo: "after",
						transactedAt: "2026-04-02",
					})
				).rejects.toThrow("server down");
			});
			// After onError, allTransactions matches the previous snapshot
			// (not the optimistic patch).
			expect(result.current.allTransactions[0]).toMatchObject({
				id: "tx1",
				count: 3,
				memo: "before",
				transactedAt: "2026-01-01",
			});
		});

		it("concurrent edits each capture their own pre-mutation snapshot (rollback of the failing edit does not undo the succeeding one)", async () => {
			const row = (count: number) => ({
				id: "tx1",
				count,
				transactedAt: "2026-01-01",
			});
			// Three observed refetches: initial (1), post-first-edit invalidate
			// (2), post-second-edit invalidate (2 again, since the rollback
			// target IS 2).
			trpcMocks.txListQueryFn
				.mockResolvedValueOnce({ items: [row(1)], nextCursor: undefined })
				.mockResolvedValueOnce({ items: [row(2)], nextCursor: undefined })
				.mockResolvedValueOnce({ items: [row(2)], nextCursor: undefined });
			const qc = createClient();
			// First call succeeds, second call rejects. Second rollback must
			// restore the snapshot taken AFTER the first optimistic patch — i.e.
			// it must not blow away the successful first edit.
			trpcMocks.txUpdate
				.mockResolvedValueOnce({ id: "tx1" })
				.mockRejectedValueOnce(new Error("net"));

			const { result } = renderHook(() => useItems("i1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.allTransactions).toHaveLength(1)
			);
			await act(async () => {
				await result.current.editTransaction({
					id: "tx1",
					count: 2,
					memo: null,
					transactedAt: "2026-01-01",
				});
			});
			await waitFor(() =>
				expect(result.current.allTransactions[0]).toMatchObject({ count: 2 })
			);
			await act(async () => {
				await expect(
					result.current.editTransaction({
						id: "tx1",
						count: 3,
						memo: null,
						transactedAt: "2026-01-01",
					})
				).rejects.toThrow("net");
			});
			// Rollback target = state right before the failing edit = 2,
			// not the original 1.
			await waitFor(() =>
				expect(result.current.allTransactions[0]).toMatchObject({ count: 2 })
			);
		});
	});

	describe("deleteTransaction (optimistic on the infinite cache)", () => {
		it("optimistically removes the transaction from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [
							{ id: "tx1", count: 1, transactedAt: "2026-01-01" },
							{ id: "tx2", count: 2, transactedAt: "2026-01-02" },
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

			const { result } = renderHook(() => useItems("i1"), {
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
			resolve?.({ success: true });
		});

		it("rolls the cache back to the pre-delete snapshot when the server rejects", async () => {
			const original = [
				{ id: "tx1", count: 1, transactedAt: "2026-01-01" },
				{ id: "tx2", count: 2, transactedAt: "2026-01-02" },
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

			const { result } = renderHook(() => useItems("i1"), {
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

		it("removes a row that lives on a later page, leaving page 1 intact (multi-page cache)", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 1, transactedAt: "2026-01-02" }],
						nextCursor: "tx1",
					},
					{
						items: [{ id: "tx2", count: 2, transactedAt: "2026-01-01" }],
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

			const { result } = renderHook(() => useItems("i1"), {
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
			}>(txInfiniteKey("i1"));
			expect(cached?.pages).toHaveLength(2);
			expect(cached?.pages[1]?.items).toEqual([]);
			resolve?.({ success: true });
		});
	});

	describe("fetchNextPage", () => {
		it("no-ops when expandedItemId is null", () => {
			const qc = createClient();
			const { result } = renderHook(() => useItems(null), {
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
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }],
						nextCursor: undefined,
					},
				])
			);
			const { result } = renderHook(() => useItems("i1"), {
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
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }],
						nextCursor: "cursor-A",
					},
				])
			);
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: [{ id: "tx2", count: 2, transactedAt: "2026-01-02" }],
				nextCursor: "cursor-B",
			});
			const { result } = renderHook(() => useItems("i1"), {
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
				itemId: "i1",
				cursor: "cursor-A",
			});
			expect(result.current.hasNextPage).toBe(true);
		});

		it("sets hasNextPage to false when the next page has no cursor", async () => {
			const qc = createClient();
			qc.setQueryData(
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }],
						nextCursor: "cursor-A",
					},
				])
			);
			trpcMocks.txListQueryFn.mockResolvedValue({
				items: [],
				nextCursor: undefined,
			});
			const { result } = renderHook(() => useItems("i1"), {
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
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }],
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
			const { result } = renderHook(() => useItems("i1"), {
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
				txInfiniteKey("i1"),
				seedPages([
					{
						items: [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }],
						nextCursor: "cursor-A",
					},
				])
			);
			trpcMocks.txListQueryFn.mockRejectedValue(new Error("network"));
			const { result } = renderHook(() => useItems("i1"), {
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
				txInfiniteKey("i1"),
				seedPages([{ items: [], nextCursor: "cursor-A" }])
			);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.txListQueryFn.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useItems("i1"), {
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
			const page1 = [{ id: "tx1", count: 1, transactedAt: "2026-01-01" }];
			const page2 = [{ id: "tx2", count: 2, transactedAt: "2026-01-02" }];
			// cursor-aware queryFn so every page refetches correctly.
			trpcMocks.txListQueryFn.mockImplementation(
				({ cursor }: { cursor?: string }) =>
					cursor === "cursor-A"
						? Promise.resolve({ items: page2, nextCursor: undefined })
						: Promise.resolve({ items: page1, nextCursor: "cursor-A" })
			);
			const qc = createClient();
			const { result } = renderHook(() => useItems("i1"), {
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
				await qc.invalidateQueries({ queryKey: txInfiniteKey("i1") });
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
		it("exposes fetchNextPage and the mutation handlers", () => {
			const qc = createClient();
			const { result } = renderHook(() => useItems(null), {
				wrapper: makeWrapper(qc),
			});
			expect(typeof result.current.fetchNextPage).toBe("function");
			expect(typeof result.current.create).toBe("function");
			expect(typeof result.current.update).toBe("function");
			expect(typeof result.current.delete).toBe("function");
			expect(typeof result.current.addTransaction).toBe("function");
			expect(typeof result.current.editTransaction).toBe("function");
			expect(typeof result.current.deleteTransaction).toBe("function");
		});
	});
});
