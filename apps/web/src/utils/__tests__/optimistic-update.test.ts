import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQueries,
	snapshotQuery,
} from "../optimistic-update";

function createQueryClientMock() {
	return {
		cancelQueries: vi.fn(async () => undefined),
		getQueriesData: vi.fn(),
		getQueryData: vi.fn(),
		invalidateQueries: vi.fn(async () => undefined),
		setQueryData: vi.fn(),
	} as unknown as QueryClient;
}

describe("optimistic-update helpers", () => {
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
});
