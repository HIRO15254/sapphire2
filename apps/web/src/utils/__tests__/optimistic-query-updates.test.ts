import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "@/__tests__/test-utils";
import {
	beginOptimisticQueryUpdate,
	updateQueryItems,
} from "../optimistic-update";

const KEY = ["transactions", { currencyId: "c1" }];

describe("overlapping optimistic query updates", () => {
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
