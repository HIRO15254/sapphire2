import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
	cancelTargets,
	createOptimisticId,
	invalidateTargets,
	prependInfiniteQueryItem,
	restoreSnapshots,
	snapshotQueries,
	snapshotQuery,
	updateInfiniteQueryItems,
	updateQueriesData,
	updateQueryData,
	updateQueryEntity,
	updateQueryItems,
} from "../optimistic-update";

interface InfiniteItem {
	amount: number;
	id: string;
}
interface InfiniteCache {
	pageParams: unknown[];
	pages: { items: InfiniteItem[]; nextCursor?: string }[];
}

/** Pull the updater callback handed to `setQueryData` out of the spy. */
function lastSetQueryDataUpdater(
	queryClient: QueryClient
): (old: InfiniteCache | undefined) => InfiniteCache | undefined {
	const calls = vi.mocked(queryClient.setQueryData).mock.calls;
	return calls.at(-1)?.[1] as (
		old: InfiniteCache | undefined
	) => InfiniteCache | undefined;
}

function createQueryClientMock() {
	return {
		cancelQueries: vi.fn(async () => undefined),
		getQueriesData: vi.fn(),
		getQueryData: vi.fn(),
		invalidateQueries: vi.fn(async () => undefined),
		setQueryData: vi.fn(),
		setQueriesData: vi.fn(),
	} as unknown as QueryClient;
}

describe("optimistic-update helpers", () => {
	it("creates distinct collision-resistant ids for consecutive calls", () => {
		const randomUUID = vi
			.spyOn(globalThis.crypto, "randomUUID")
			.mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
			.mockReturnValueOnce("00000000-0000-4000-8000-000000000002");

		const first = createOptimisticId("temp");
		const second = createOptimisticId("temp");

		expect(first).toBe("temp-00000000-0000-4000-8000-000000000001");
		expect(second).toBe("temp-00000000-0000-4000-8000-000000000002");
		expect(first).not.toBe(second);
		expect(randomUUID).toHaveBeenCalledTimes(2);

		randomUUID.mockRestore();
	});

	it("snapshots and restores a single query", () => {
		const queryClient = createQueryClientMock();
		const queryKey = ["players"] satisfies QueryKey;
		vi.mocked(queryClient.getQueryData).mockReturnValue([{ id: "player-1" }]);

		const snapshot = snapshotQuery(queryClient, queryKey);

		restoreSnapshots(queryClient, [snapshot]);

		expect(snapshot).toEqual({
			data: [{ id: "player-1" }],
			kind: "query",
			queryKey,
		});
		expect(queryClient.setQueryData).toHaveBeenCalledWith(queryKey, [
			{ id: "player-1" },
		]);
	});

	it("snapshots and restores multiple matching queries", () => {
		const queryClient = createQueryClientMock();
		const entries: [QueryKey, { id: string }[]][] = [
			[["players", "a"], [{ id: "player-a" }]],
			[["players", "b"], [{ id: "player-b" }]],
		];
		vi.mocked(queryClient.getQueriesData).mockReturnValue(entries);

		const snapshot = snapshotQueries(queryClient, { queryKey: ["players"] });

		restoreSnapshots(queryClient, [snapshot]);

		expect(snapshot).toEqual({
			entries,
			kind: "queries",
		});
		expect(queryClient.setQueryData).toHaveBeenNthCalledWith(
			1,
			["players", "a"],
			[{ id: "player-a" }]
		);
		expect(queryClient.setQueryData).toHaveBeenNthCalledWith(
			2,
			["players", "b"],
			[{ id: "player-b" }]
		);
	});

	it("cancels and invalidates multiple target styles", async () => {
		const queryClient = createQueryClientMock();

		await cancelTargets(queryClient, [
			{ queryKey: ["players"] },
			{ filters: { queryKey: ["sessions"] } },
		]);
		await invalidateTargets(queryClient, [
			{ queryKey: ["players"] },
			{ filters: { queryKey: ["sessions"] } },
		]);

		expect(queryClient.cancelQueries).toHaveBeenNthCalledWith(1, {
			queryKey: ["players"],
		});
		expect(queryClient.cancelQueries).toHaveBeenNthCalledWith(2, {
			queryKey: ["sessions"],
		});
		expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
			queryKey: ["players"],
		});
		expect(queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
			queryKey: ["sessions"],
		});
	});

	it("snapshotQuery captures undefined when the cache is empty", () => {
		const queryClient = createQueryClientMock();
		vi.mocked(queryClient.getQueryData).mockReturnValue(undefined);

		const snapshot = snapshotQuery(queryClient, ["players"]);

		expect(snapshot).toEqual({
			data: undefined,
			kind: "query",
			queryKey: ["players"],
		});
	});

	it("snapshotQueries returns empty entries when no queries match", () => {
		const queryClient = createQueryClientMock();
		vi.mocked(queryClient.getQueriesData).mockReturnValue([]);

		const snapshot = snapshotQueries(queryClient, {
			queryKey: ["missing"],
		});

		expect(snapshot).toEqual({ entries: [], kind: "queries" });
	});

	it("restoreSnapshots ignores null and undefined entries", () => {
		const queryClient = createQueryClientMock();

		restoreSnapshots(queryClient, [null, undefined]);

		expect(queryClient.setQueryData).not.toHaveBeenCalled();
	});

	it("restoreSnapshots handles a mixed array of query and queries snapshots", () => {
		const queryClient = createQueryClientMock();

		restoreSnapshots(queryClient, [
			{ data: { id: "a" }, kind: "query", queryKey: ["players", "a"] },
			{
				entries: [[["sessions", "s1"], { id: "s1" }]],
				kind: "queries",
			},
			null,
		]);

		expect(queryClient.setQueryData).toHaveBeenCalledTimes(2);
		expect(queryClient.setQueryData).toHaveBeenNthCalledWith(
			1,
			["players", "a"],
			{ id: "a" }
		);
		expect(queryClient.setQueryData).toHaveBeenNthCalledWith(
			2,
			["sessions", "s1"],
			{ id: "s1" }
		);
	});

	it("cancelTargets awaits every cancel in parallel", async () => {
		const queryClient = createQueryClientMock();
		const resolvers: Array<() => void> = [];
		vi.mocked(queryClient.cancelQueries).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolvers.push(resolve);
				})
		);

		const pending = cancelTargets(queryClient, [
			{ queryKey: ["a"] },
			{ queryKey: ["b"] },
			{ queryKey: ["c"] },
		]);

		expect(queryClient.cancelQueries).toHaveBeenCalledTimes(3);
		expect(resolvers).toHaveLength(3);
		for (const resolve of resolvers) {
			resolve();
		}
		await pending;
	});

	it("invalidateTargets returns a promise that resolves when all are done", async () => {
		const queryClient = createQueryClientMock();
		vi.mocked(queryClient.invalidateQueries).mockResolvedValue(undefined);

		await expect(
			invalidateTargets(queryClient, [{ queryKey: ["x"] }])
		).resolves.toBeUndefined();
		expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
	});

	it("accepts an empty targets array for cancel and invalidate", async () => {
		const queryClient = createQueryClientMock();

		await cancelTargets(queryClient, []);
		await invalidateTargets(queryClient, []);

		expect(queryClient.cancelQueries).not.toHaveBeenCalled();
		expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
	});

	describe("updateInfiniteQueryItems", () => {
		it("maps items across every page and preserves each page's nextCursor", () => {
			const queryClient = createQueryClientMock();

			updateInfiniteQueryItems<InfiniteItem>(queryClient, ["tx"], (items) =>
				items.map((t) => (t.id === "tx3" ? { ...t, amount: 999 } : t))
			);

			expect(queryClient.setQueryData).toHaveBeenCalledTimes(1);
			expect(vi.mocked(queryClient.setQueryData).mock.calls[0]?.[0]).toEqual([
				"tx",
			]);
			const updater = lastSetQueryDataUpdater(queryClient);
			const old: InfiniteCache = {
				pageParams: [undefined, "tx2"],
				pages: [
					{
						items: [
							{ id: "tx1", amount: 1 },
							{ id: "tx2", amount: 2 },
						],
						nextCursor: "tx2",
					},
					{ items: [{ id: "tx3", amount: 3 }], nextCursor: undefined },
				],
			};

			expect(updater(old)).toEqual({
				pageParams: [undefined, "tx2"],
				pages: [
					{
						items: [
							{ id: "tx1", amount: 1 },
							{ id: "tx2", amount: 2 },
						],
						nextCursor: "tx2",
					},
					{ items: [{ id: "tx3", amount: 999 }], nextCursor: undefined },
				],
			});
		});

		it("filters items across every page (delete) while keeping page structure", () => {
			const queryClient = createQueryClientMock();

			updateInfiniteQueryItems<InfiniteItem>(queryClient, ["tx"], (items) =>
				items.filter((t) => t.id !== "tx2")
			);

			const updater = lastSetQueryDataUpdater(queryClient);
			const old: InfiniteCache = {
				pageParams: [undefined, "tx2"],
				pages: [
					{
						items: [
							{ id: "tx1", amount: 1 },
							{ id: "tx2", amount: 2 },
						],
						nextCursor: "tx2",
					},
					{ items: [{ id: "tx3", amount: 3 }], nextCursor: undefined },
				],
			};

			expect(updater(old)).toEqual({
				pageParams: [undefined, "tx2"],
				pages: [
					{ items: [{ id: "tx1", amount: 1 }], nextCursor: "tx2" },
					{ items: [{ id: "tx3", amount: 3 }], nextCursor: undefined },
				],
			});
		});

		it("returns undefined (no-op) when the cache entry is empty", () => {
			const queryClient = createQueryClientMock();

			updateInfiniteQueryItems<InfiniteItem>(queryClient, ["tx"], (items) =>
				items.map((t) => ({ ...t, amount: 0 }))
			);

			const updater = lastSetQueryDataUpdater(queryClient);
			expect(updater(undefined)).toBeUndefined();
		});

		it("handles an empty pages array without calling the updater", () => {
			const queryClient = createQueryClientMock();
			const updateItems = vi.fn((items: InfiniteItem[]) => items);

			updateInfiniteQueryItems<InfiniteItem>(queryClient, ["tx"], updateItems);

			const updater = lastSetQueryDataUpdater(queryClient);
			expect(updater({ pageParams: [], pages: [] })).toEqual({
				pageParams: [],
				pages: [],
			});
			expect(updateItems).not.toHaveBeenCalled();
		});

		it("can empty a page entirely (delete the only row on a page)", () => {
			const queryClient = createQueryClientMock();

			updateInfiniteQueryItems<InfiniteItem>(queryClient, ["tx"], (items) =>
				items.filter((t) => t.id !== "tx2")
			);

			const updater = lastSetQueryDataUpdater(queryClient);
			const old: InfiniteCache = {
				pageParams: [undefined, "tx1"],
				pages: [
					{ items: [{ id: "tx1", amount: 1 }], nextCursor: "tx1" },
					{ items: [{ id: "tx2", amount: 2 }], nextCursor: undefined },
				],
			};

			expect(updater(old)).toEqual({
				pageParams: [undefined, "tx1"],
				pages: [
					{ items: [{ id: "tx1", amount: 1 }], nextCursor: "tx1" },
					{ items: [], nextCursor: undefined },
				],
			});
		});
	});

	describe("prependInfiniteQueryItem", () => {
		it("prepends the item to the first page only and preserves the envelope", () => {
			const queryClient = createQueryClientMock();

			prependInfiniteQueryItem<InfiniteItem>(queryClient, ["tx"], {
				id: "new",
				amount: 7,
			});

			expect(queryClient.setQueryData).toHaveBeenCalledTimes(1);
			expect(vi.mocked(queryClient.setQueryData).mock.calls[0]?.[0]).toEqual([
				"tx",
			]);
			const updater = lastSetQueryDataUpdater(queryClient);
			const old: InfiniteCache = {
				pageParams: [undefined, "tx2"],
				pages: [
					{ items: [{ id: "tx1", amount: 1 }], nextCursor: "tx1" },
					{ items: [{ id: "tx2", amount: 2 }], nextCursor: undefined },
				],
			};

			expect(updater(old)).toEqual({
				pageParams: [undefined, "tx2"],
				pages: [
					{
						items: [
							{ id: "new", amount: 7 },
							{ id: "tx1", amount: 1 },
						],
						nextCursor: "tx1",
					},
					{ items: [{ id: "tx2", amount: 2 }], nextCursor: undefined },
				],
			});
		});

		it("returns undefined (no-op) when the cache entry is empty", () => {
			const queryClient = createQueryClientMock();

			prependInfiniteQueryItem<InfiniteItem>(queryClient, ["tx"], {
				id: "new",
				amount: 7,
			});

			const updater = lastSetQueryDataUpdater(queryClient);
			expect(updater(undefined)).toBeUndefined();
		});

		it("leaves an empty pages array untouched rather than fabricating a page", () => {
			const queryClient = createQueryClientMock();

			prependInfiniteQueryItem<InfiniteItem>(queryClient, ["tx"], {
				id: "new",
				amount: 7,
			});

			const updater = lastSetQueryDataUpdater(queryClient);
			expect(updater({ pageParams: [], pages: [] })).toEqual({
				pageParams: [],
				pages: [],
			});
		});
	});

	describe("updateQueryEntity", () => {
		interface Entity {
			heroSeat: number | null;
			name: string;
		}

		/** Pull the updater handed to `setQueryData`, typed for a single entity. */
		function entityUpdater(
			queryClient: QueryClient
		): (old: Entity | null | undefined) => Entity | null | undefined {
			const calls = vi.mocked(queryClient.setQueryData).mock.calls;
			return calls.at(-1)?.[1] as (
				old: Entity | null | undefined
			) => Entity | null | undefined;
		}

		it("shallow-merges a static partial into the existing entity", () => {
			const queryClient = createQueryClientMock();

			updateQueryEntity<Entity>(queryClient, ["session", "s1"], {
				heroSeat: 4,
			});

			expect(queryClient.setQueryData).toHaveBeenCalledTimes(1);
			expect(vi.mocked(queryClient.setQueryData).mock.calls[0]?.[0]).toEqual([
				"session",
				"s1",
			]);
			const updater = entityUpdater(queryClient);
			expect(updater({ heroSeat: 1, name: "Alice" })).toEqual({
				heroSeat: 4,
				name: "Alice",
			});
		});

		it("merges a partial of null to clear a field", () => {
			const queryClient = createQueryClientMock();

			updateQueryEntity<Entity>(queryClient, ["session", "s1"], {
				heroSeat: null,
			});

			const updater = entityUpdater(queryClient);
			expect(updater({ heroSeat: 9, name: "Alice" })).toEqual({
				heroSeat: null,
				name: "Alice",
			});
		});

		it("derives the patch from the current entity when patch is a function", () => {
			const queryClient = createQueryClientMock();

			updateQueryEntity<Entity>(queryClient, ["session", "s1"], (entity) => ({
				name: `${entity.name} (edited)`,
			}));

			const updater = entityUpdater(queryClient);
			expect(updater({ heroSeat: 2, name: "Bob" })).toEqual({
				heroSeat: 2,
				name: "Bob (edited)",
			});
		});

		it("returns undefined (no-op) when the cache entry is unfetched", () => {
			const queryClient = createQueryClientMock();
			const patch = vi.fn(() => ({ name: "never" }));

			updateQueryEntity<Entity>(queryClient, ["session", "s1"], patch);

			const updater = entityUpdater(queryClient);
			expect(updater(undefined)).toBeUndefined();
			expect(patch).not.toHaveBeenCalled();
		});

		it("returns null (no-op) when the cache entry is explicitly null", () => {
			const queryClient = createQueryClientMock();
			const patch = vi.fn(() => ({ name: "never" }));

			updateQueryEntity<Entity>(queryClient, ["session", "s1"], patch);

			const updater = entityUpdater(queryClient);
			expect(updater(null)).toBeNull();
			expect(patch).not.toHaveBeenCalled();
		});
	});

	describe("updateQueryData", () => {
		it("passes an unfetched value to the updater so callers can deliberately create a cache entry", () => {
			const queryClient = createQueryClientMock();
			updateQueryData<{ items: string[] }>(
				queryClient,
				["sessions", "active"],
				(old) => ({ items: ["s1", ...(old?.items ?? [])] })
			);
			const updater = vi.mocked(queryClient.setQueryData).mock
				.calls[0]?.[1] as (
				old: { items: string[] } | undefined
			) => { items: string[] } | undefined;
			expect(updater(undefined)).toEqual({ items: ["s1"] });
		});
	});

	describe("updateQueriesData", () => {
		it("rewrites every matching list cache and preserves undefined entries", () => {
			const queryClient = createQueryClientMock();
			updateQueriesData<string[]>(
				queryClient,
				{ queryKey: ["players", "list"] },
				(old) => old?.filter((id) => id !== "p1")
			);
			expect(queryClient.setQueriesData).toHaveBeenCalledTimes(1);
			const updater = vi.mocked(queryClient.setQueriesData).mock
				.calls[0]?.[1] as (old: string[] | undefined) => string[] | undefined;
			expect(updater(["p1", "p2"])).toEqual(["p2"]);
			expect(updater(undefined)).toBeUndefined();
		});
	});
	describe("updateQueryItems", () => {
		interface Item {
			amount: number;
			id: string;
		}

		/** Pull the updater handed to `setQueryData`, typed for a plain array. */
		function itemsUpdater(
			queryClient: QueryClient
		): (old: Item[] | undefined) => Item[] | undefined {
			const calls = vi.mocked(queryClient.setQueryData).mock.calls;
			return calls.at(-1)?.[1] as (
				old: Item[] | undefined
			) => Item[] | undefined;
		}

		it("maps one matching item by id and leaves the rest untouched (edit)", () => {
			const queryClient = createQueryClientMock();

			updateQueryItems<Item>(queryClient, ["events"], (items) =>
				items.map((item) => (item.id === "e2" ? { ...item, amount: 99 } : item))
			);

			expect(queryClient.setQueryData).toHaveBeenCalledTimes(1);
			expect(vi.mocked(queryClient.setQueryData).mock.calls[0]?.[0]).toEqual([
				"events",
			]);
			const updater = itemsUpdater(queryClient);
			expect(
				updater([
					{ id: "e1", amount: 1 },
					{ id: "e2", amount: 2 },
				])
			).toEqual([
				{ id: "e1", amount: 1 },
				{ id: "e2", amount: 99 },
			]);
		});

		it("filters a matching item out (delete)", () => {
			const queryClient = createQueryClientMock();

			updateQueryItems<Item>(queryClient, ["events"], (items) =>
				items.filter((item) => item.id !== "e1")
			);

			const updater = itemsUpdater(queryClient);
			expect(
				updater([
					{ id: "e1", amount: 1 },
					{ id: "e2", amount: 2 },
				])
			).toEqual([{ id: "e2", amount: 2 }]);
		});

		it("maps an empty array to an empty array without fabricating rows", () => {
			const queryClient = createQueryClientMock();
			const updateItems = vi.fn((items: Item[]) => items);

			updateQueryItems<Item>(queryClient, ["events"], updateItems);

			const updater = itemsUpdater(queryClient);
			expect(updater([])).toEqual([]);
			expect(updateItems).toHaveBeenCalledTimes(1);
			expect(updateItems).toHaveBeenCalledWith([]);
		});

		it("returns undefined (no-op) when the cache entry is unfetched", () => {
			const queryClient = createQueryClientMock();
			const updateItems = vi.fn((items: Item[]) => items);

			updateQueryItems<Item>(queryClient, ["events"], updateItems);

			const updater = itemsUpdater(queryClient);
			expect(updater(undefined)).toBeUndefined();
			expect(updateItems).not.toHaveBeenCalled();
		});

		it("uses fallback items when an optimistic flow intentionally creates an unfetched list", () => {
			const queryClient = createQueryClientMock();
			const updateItems = vi.fn((items: Item[]) => items);
			const fallbackItems = [{ id: "new", amount: 7 }];

			updateQueryItems<Item>(
				queryClient,
				["events"],
				updateItems,
				fallbackItems
			);

			expect(itemsUpdater(queryClient)(undefined)).toEqual(fallbackItems);
			expect(updateItems).not.toHaveBeenCalled();
		});
	});
});
