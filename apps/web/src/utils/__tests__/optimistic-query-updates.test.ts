import { InfiniteQueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "@/__tests__/test-utils";
import {
	beginOptimisticQueryUpdate,
	updateInfiniteQueryItems,
	updateQueryItems,
} from "../optimistic-update";

const KEY = ["transactions", { currencyId: "c1" }];

describe("overlapping optimistic query updates", () => {
	it.each([
		"edit",
		"create",
	])("keeps refetched server changes and pending %s state through rollback", async (operation) => {
		const client = createTestQueryClient();
		client.setQueryData(KEY, [
			{ id: "tx1", amount: 100 },
			{ id: "tx2", amount: 50 },
		]);
		const change = beginOptimisticQueryUpdate(client, KEY, () => {
			if (operation === "edit") {
				updateQueryItems<{ id: string; amount: number }>(client, KEY, (rows) =>
					rows.map((row) => (row.id === "tx1" ? { ...row, amount: 200 } : row))
				);
			}
		});
		const response = Promise.withResolvers<{ id: string; amount: number }[]>();
		const refetch = client.fetchQuery({
			queryKey: KEY,
			queryFn: () => response.promise,
			staleTime: 0,
		});
		const serverRows = [
			{ id: "tx1", amount: 150 },
			{ id: "tx2", amount: 75 },
		];
		response.resolve(serverRows);
		await refetch;
		expect(client.getQueryData(KEY)).toEqual([
			{ id: "tx1", amount: operation === "edit" ? 200 : 150 },
			{ id: "tx2", amount: 75 },
		]);
		expect(change.settle(false)).toBe(true);
		expect(client.getQueryData(KEY)).toEqual(serverRows);
		client.clear();
	});

	it.each([
		"edit",
		"delete",
		"create",
	])("keeps a page loaded while %s is pending after the mutation fails", async (operation) => {
		const client = createTestQueryClient();
		const first = { items: [{ id: "tx1", amount: 100 }], nextCursor: "next" };
		const second = {
			items: [{ id: "tx2", amount: 50 }],
			nextCursor: undefined,
		};
		client.setQueryData(KEY, { pages: [first], pageParams: [undefined] });
		const response = Promise.withResolvers<typeof second>();
		const observer = new InfiniteQueryObserver(client, {
			queryKey: KEY,
			queryFn: () => response.promise,
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (page) => page.nextCursor,
		});
		const change = beginOptimisticQueryUpdate(client, KEY, () => {
			if (operation !== "create") {
				updateInfiniteQueryItems<{ id: string; amount: number }>(
					client,
					KEY,
					(rows) =>
						operation === "delete"
							? rows.filter((row) => row.id !== "tx1")
							: rows.map((row) =>
									row.id === "tx1" ? { ...row, amount: 200 } : row
								)
				);
			}
		});
		const nextPage = observer.fetchNextPage();
		response.resolve(second);
		await nextPage;
		expect(client.getQueryData(KEY)).toEqual({
			pages: [
				{
					...first,
					items:
						operation === "delete"
							? []
							: [{ id: "tx1", amount: operation === "edit" ? 200 : 100 }],
				},
				second,
			],
			pageParams: [undefined, "next"],
		});
		expect(change.settle(false)).toBe(true);
		expect(client.getQueryData(KEY)).toEqual({
			pages: [first, second],
			pageParams: [undefined, "next"],
		});
		observer.destroy();
		client.clear();
	});

	it.each([
		false,
		true,
	])("keeps an in-flight page response safe when the last mutation settles first (success: %s)", async (succeeded) => {
		const client = createTestQueryClient();
		const first = { items: [{ id: "tx1", amount: 100 }], nextCursor: "next" };
		const second = {
			items: [{ id: "tx2", amount: 50 }],
			nextCursor: undefined,
		};
		client.setQueryData(KEY, { pages: [first], pageParams: [undefined] });
		const response = Promise.withResolvers<typeof second>();
		const observer = new InfiniteQueryObserver(client, {
			queryKey: KEY,
			queryFn: () => response.promise,
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (page) => page.nextCursor,
		});
		const change = beginOptimisticQueryUpdate(client, KEY, () =>
			updateInfiniteQueryItems<{ id: string; amount: number }>(
				client,
				KEY,
				(rows) =>
					rows.map((row) => (row.id === "tx1" ? { ...row, amount: 200 } : row))
			)
		);
		const nextPage = observer.fetchNextPage();
		expect(change.settle(succeeded)).toBe(true);
		response.resolve(second);
		await nextPage;
		expect(client.getQueryData(KEY)).toEqual({
			pages: [
				{ ...first, items: [{ id: "tx1", amount: succeeded ? 200 : 100 }] },
				second,
			],
			pageParams: [undefined, "next"],
		});
		client.setQueryData(KEY, { pages: [second], pageParams: [undefined] });
		expect(client.getQueryData(KEY)).toEqual({
			pages: [second],
			pageParams: [undefined],
		});
		observer.destroy();
		client.clear();
	});

	it("keeps the rollback and a sibling edit when the in-flight page is cancelled", async () => {
		const client = createTestQueryClient();
		const initial = {
			items: [
				{ id: "tx1", amount: 100 },
				{ id: "tx2", amount: 50 },
			],
			nextCursor: "next",
		};
		client.setQueryData(KEY, { pages: [initial], pageParams: [undefined] });
		const response = Promise.withResolvers<typeof initial>();
		const observer = new InfiniteQueryObserver(client, {
			queryKey: KEY,
			queryFn: () => response.promise,
			initialPageParam: undefined as string | undefined,
			getNextPageParam: (page) => page.nextCursor,
		});
		const changes = ["tx1", "tx2"].map((id) =>
			beginOptimisticQueryUpdate(client, KEY, () =>
				updateInfiniteQueryItems<{ id: string; amount: number }>(
					client,
					KEY,
					(rows) =>
						rows.map((row) => (row.id === id ? { ...row, amount: 300 } : row))
				)
			)
		);
		const nextPage = observer.fetchNextPage();
		expect(changes[0]?.settle(false)).toBe(false);
		await client.cancelQueries({ queryKey: KEY });
		expect(client.getQueryData(KEY)).toEqual({
			pages: [
				{
					...initial,
					items: [
						{ id: "tx1", amount: 100 },
						{ id: "tx2", amount: 300 },
					],
				},
			],
			pageParams: [undefined],
		});
		expect(changes[1]?.settle(false)).toBe(true);
		response.resolve(initial);
		await nextPage;
		expect(client.getQueryData(KEY)).toEqual({
			pages: [initial],
			pageParams: [undefined],
		});
		observer.destroy();
		client.clear();
	});

	it.each([
		false,
		true,
	])("releases a throwing update without poisoning the group (existing update: %s)", (hasExistingUpdate) => {
		const client = createTestQueryClient();
		client.setQueryData(KEY, [100]);
		const existing = hasExistingUpdate
			? beginOptimisticQueryUpdate(client, KEY, () =>
					updateQueryItems<number>(client, KEY, () => [200])
				)
			: undefined;
		expect(() =>
			beginOptimisticQueryUpdate(client, KEY, () => {
				updateQueryItems<number>(client, KEY, () => [999]);
				throw new Error("cannot apply update");
			})
		).toThrow("cannot apply update");
		expect(client.getQueryData(KEY)).toEqual([hasExistingUpdate ? 200 : 100]);
		if (existing) {
			expect(existing.settle(true)).toBe(true);
		}
		client.setQueryData(KEY, [250]);
		const next = beginOptimisticQueryUpdate(client, KEY, () =>
			updateQueryItems<number>(client, KEY, () => [300])
		);
		expect(next.settle(false)).toBe(true);
		expect(client.getQueryData(KEY)).toEqual([250]);
		client.clear();
	});

	it("ignores repeated settlement without rolling back or removing a newer group", () => {
		const client = createTestQueryClient();
		client.setQueryData(KEY, [100]);
		const first = beginOptimisticQueryUpdate(client, KEY, () =>
			updateQueryItems<number>(client, KEY, () => [200])
		);
		expect(first.settle(true)).toBe(true);
		client.setQueryData(KEY, [250]);
		const second = beginOptimisticQueryUpdate(client, KEY, () =>
			updateQueryItems<number>(client, KEY, () => [300])
		);
		expect(first.settle(false)).toBe(false);
		expect(client.getQueryData(KEY)).toEqual([300]);
		const third = beginOptimisticQueryUpdate(client, KEY, () =>
			updateQueryItems<number>(client, KEY, () => [400])
		);
		expect(second.settle(false)).toBe(false);
		expect(client.getQueryData(KEY)).toEqual([400]);
		expect(third.settle(false)).toBe(true);
		expect(client.getQueryData(KEY)).toEqual([250]);
		client.clear();
	});

	it("drops a projection that cannot replay while preserving the fetched data and sibling update", async () => {
		const client = createTestQueryClient();
		client.setQueryData(KEY, [
			{ id: "tx1", amount: 100 },
			{ id: "tx2", amount: 50 },
		]);
		const first = beginOptimisticQueryUpdate(client, KEY, () => {
			const rows = client.getQueryData<{ id: string; amount: number }[]>(KEY);
			updateQueryItems<{ id: string; amount: number }>(client, KEY, () => [
				{ id: "tx1", amount: 999 },
			]);
			if (!rows?.some((row) => row.id === "tx1")) {
				throw new Error("transaction no longer exists");
			}
			updateQueryItems<{ id: string; amount: number }>(client, KEY, () =>
				rows.map((row) => (row.id === "tx1" ? { ...row, amount: 200 } : row))
			);
		});
		const second = beginOptimisticQueryUpdate(client, KEY, () =>
			updateQueryItems<{ id: string; amount: number }>(client, KEY, (rows) =>
				rows.map((row) => (row.id === "tx2" ? { ...row, amount: 300 } : row))
			)
		);
		await client.fetchQuery({
			queryKey: KEY,
			queryFn: () => Promise.resolve([{ id: "tx2", amount: 75 }]),
			staleTime: 0,
		});
		expect(client.getQueryData(KEY)).toEqual([{ id: "tx2", amount: 300 }]);
		expect(first.settle(true)).toBe(false);
		expect(second.settle(false)).toBe(true);
		expect(client.getQueryData(KEY)).toEqual([{ id: "tx2", amount: 75 }]);
		client.setQueryData(KEY, [{ id: "tx3", amount: 400 }]);
		expect(client.getQueryData(KEY)).toEqual([{ id: "tx3", amount: 400 }]);
		client.clear();
	});

	it("does not restore removed cache data when an old mutation settles", () => {
		const client = createTestQueryClient();
		client.setQueryData(KEY, [100]);
		const old = beginOptimisticQueryUpdate(client, KEY, () =>
			updateQueryItems<number>(client, KEY, () => [200])
		);
		client.removeQueries({ queryKey: KEY });
		client.setQueryData(KEY, [900]);
		const next = beginOptimisticQueryUpdate(client, KEY, () =>
			updateQueryItems<number>(client, KEY, () => [999])
		);
		expect(old.settle(false)).toBe(false);
		expect(client.getQueryData(KEY)).toEqual([999]);
		expect(next.settle(false)).toBe(true);
		expect(client.getQueryData(KEY)).toEqual([900]);
		client.clear();
	});

	it.each([
		{ order: [0, 1], successes: [false, true], intermediate: 300, final: 300 },
		{ order: [1, 0], successes: [false, true], intermediate: 300, final: 300 },
		{ order: [0, 1], successes: [true, false], intermediate: 300, final: 200 },
		{ order: [1, 0], successes: [true, false], intermediate: 200, final: 200 },
		{ order: [0, 1], successes: [false, false], intermediate: 300, final: 100 },
		{ order: [1, 0], successes: [false, false], intermediate: 200, final: 100 },
	])("reconciles same-row updates: $order / $successes", ({
		order,
		successes,
		intermediate,
		final,
	}) => {
		const client = createTestQueryClient();
		client.setQueryData(KEY, [{ id: "tx1", amount: 100 }]);
		const changes = [200, 300].map((amount) =>
			beginOptimisticQueryUpdate(client, KEY, () => {
				updateQueryItems<{ id: string; amount: number }>(client, KEY, (rows) =>
					rows.map((row) => ({ ...row, amount }))
				);
			})
		);
		const first = order[0] ?? 0;
		const last = order[1] ?? 1;
		expect(changes[first]?.settle(successes[first] ?? false)).toBe(false);
		expect(client.getQueryData(KEY)).toEqual([
			{ id: "tx1", amount: intermediate },
		]);
		expect(changes[last]?.settle(successes[last] ?? false)).toBe(true);
		expect(client.getQueryData(KEY)).toEqual([{ id: "tx1", amount: final }]);
		client.clear();
	});

	it("restores a rejected deletion without losing a pending edit to its sibling", () => {
		const client = createTestQueryClient();
		client.setQueryData(KEY, [
			{ id: "tx1", amount: 100 },
			{ id: "tx2", amount: 50 },
		]);
		const deletion = beginOptimisticQueryUpdate(client, KEY, () => {
			updateQueryItems<{ id: string; amount: number }>(client, KEY, (rows) =>
				rows.filter((row) => row.id !== "tx1")
			);
		});
		const edit = beginOptimisticQueryUpdate(client, KEY, () => {
			updateQueryItems<{ id: string; amount: number }>(client, KEY, (rows) =>
				rows.map((row) => (row.id === "tx2" ? { ...row, amount: 300 } : row))
			);
		});
		expect(deletion.settle(false)).toBe(false);
		expect(client.getQueryData(KEY)).toEqual([
			{ id: "tx1", amount: 100 },
			{ id: "tx2", amount: 300 },
		]);
		expect(edit.settle(true)).toBe(true);
		client.clear();
	});

	it("starts the next group from refetched data and isolates query clients", () => {
		const first = createTestQueryClient();
		const second = createTestQueryClient();
		first.setQueryData(KEY, [100]);
		second.setQueryData(KEY, [900]);
		const firstEdit = beginOptimisticQueryUpdate(first, KEY, () =>
			updateQueryItems<number>(first, KEY, () => [200])
		);
		const secondEdit = beginOptimisticQueryUpdate(second, KEY, () =>
			updateQueryItems<number>(second, KEY, () => [999])
		);
		expect(firstEdit.settle(true)).toBe(true);
		first.setQueryData(KEY, [250]);
		const nextEdit = beginOptimisticQueryUpdate(first, KEY, () =>
			updateQueryItems<number>(first, KEY, () => [300])
		);
		expect(nextEdit.settle(false)).toBe(true);
		expect(first.getQueryData(KEY)).toEqual([250]);
		expect(second.getQueryData(KEY)).toEqual([999]);
		expect(secondEdit.settle(false)).toBe(true);
		expect(second.getQueryData(KEY)).toEqual([900]);
		first.clear();
		second.clear();
	});
});
