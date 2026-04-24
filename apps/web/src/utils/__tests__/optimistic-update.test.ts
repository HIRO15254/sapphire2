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
});
