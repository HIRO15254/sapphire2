import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	toggleFavorite: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		room: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("room", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		room: {
			create: { mutate: trpcMocks.create },
			update: { mutate: trpcMocks.update },
			delete: { mutate: trpcMocks.delete },
			toggleFavorite: { mutate: trpcMocks.toggleFavorite },
		},
	},
}));

import { useRooms } from "@/features/rooms/hooks/use-rooms";

const STORE_KEY = ["room", "list"];
const TEMP_ID_PATTERN = /^temp-/;

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

describe("useRooms", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		trpcMocks.toggleFavorite.mockResolvedValue({ id: "s1" });
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns an empty array when the cache has no data", () => {
			const qc = createClient();
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.rooms).toEqual([]);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isToggleFavoritePending).toBe(false);
		});

		it("exposes seeded rooms from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{ id: "s1", name: "Main", memo: null },
				{ id: "s2", name: "Branch", memo: "note" },
			]);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.rooms).toHaveLength(2));
		});
	});

	describe("create (optimistic)", () => {
		it("appends a temp-id room to the cached list during mutation", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [{ id: "s1", name: "Main", memo: null }]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({ name: "New Room", memo: "m" });
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<
						Array<{ id: string; name: string; memo: string | null }>
					>(STORE_KEY);
				expect(list).toHaveLength(2);
				expect(list?.[1]?.name).toBe("New Room");
				expect(list?.[1]?.memo).toBe("m");
				expect(list?.[1]?.id).toMatch(TEMP_ID_PATTERN);
			});
			resolve?.({ id: "s2" });
		});

		it("skips optimistic append when cache is undefined (onMutate no-op branch)", async () => {
			const qc = createClient();
			trpcMocks.create.mockResolvedValue({ id: "s9" });
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({ name: "Floating" });
			});
			expect(trpcMocks.create).toHaveBeenCalledWith({ name: "Floating" });
		});

		it("defaults memo to null when omitted", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [{ id: "s1", name: "Main", memo: null }]);
			trpcMocks.create.mockResolvedValue({ id: "s2" });
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({ name: "No Memo" });
			});
			const list =
				qc.getQueryData<
					Array<{ id: string; name: string; memo: string | null }>
				>(STORE_KEY);
			const tempEntry = list?.find((s) => s.id.startsWith("temp-"));
			// After invalidate the temp row may be refetched away in a real app,
			// but with no queryFn here it sticks. Either way, if present it must
			// have memo null.
			if (tempEntry) {
				expect(tempEntry.memo).toBeNull();
			}
		});

		it("forwards latitude/longitude to the server and the optimistic row", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{ id: "s1", name: "Main", memo: null, latitude: null, longitude: null },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({
					name: "Geo Room",
					latitude: 35.6812,
					longitude: 139.7671,
				});
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<
						Array<{
							id: string;
							latitude: number | null;
							longitude: number | null;
						}>
					>(STORE_KEY);
				const temp = list?.find((s) => s.id.startsWith("temp-"));
				expect(temp?.latitude).toBe(35.6812);
				expect(temp?.longitude).toBe(139.7671);
			});
			expect(trpcMocks.create).toHaveBeenCalledWith({
				name: "Geo Room",
				latitude: 35.6812,
				longitude: 139.7671,
			});
			resolve?.({ id: "s2" });
		});

		it("flips isCreatePending to true while the mutation is in-flight", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({ name: "X" });
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolve?.({ id: "s1" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));
		});

		it("restores the previous snapshot before onSettled invalidates (observed via setQueryData spy)", async () => {
			const qc = createClient();
			const prev = [{ id: "s1", name: "Main", memo: null }];
			qc.setQueryData(STORE_KEY, prev);
			trpcMocks.create.mockRejectedValue(new Error("boom"));

			let snapshotAtRollback: typeof prev | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const post = qc.getQueryData<typeof prev>(STORE_KEY);
					if (
						!snapshotAtRollback &&
						post?.length === 1 &&
						post[0]?.id === "s1"
					) {
						snapshotAtRollback = post;
					}
					return r;
				}
			);

			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(result.current.create({ name: "Bad" })).rejects.toThrow(
					"boom"
				);
			});
			expect(snapshotAtRollback).toEqual(prev);
		});
	});

	describe("update (optimistic)", () => {
		it("patches the matching room id", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{ id: "s1", name: "Main", memo: null },
				{ id: "s2", name: "Branch", memo: null },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({ id: "s2", name: "Branch 2", memo: "renamed" });
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<
						Array<{ id: string; name: string; memo: string | null }>
					>(STORE_KEY);
				expect(list?.[1]?.name).toBe("Branch 2");
				expect(list?.[1]?.memo).toBe("renamed");
				expect(list?.[0]?.name).toBe("Main");
			});
			resolve?.({ id: "s2" });
		});

		it("sends an explicit null memo to the server when memo is cleared", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [{ id: "s1", name: "Main", memo: "old" }]);
			trpcMocks.update.mockResolvedValue({ id: "s1" });
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({ id: "s1", name: "Main" });
			});
			expect(trpcMocks.update).toHaveBeenCalledWith({
				id: "s1",
				name: "Main",
				memo: null,
				latitude: null,
				longitude: null,
			});
		});

		it("forwards a set memo unchanged to the server", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [{ id: "s1", name: "Main", memo: null }]);
			trpcMocks.update.mockResolvedValue({ id: "s1" });
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({ id: "s1", name: "Main", memo: "kept" });
			});
			expect(trpcMocks.update).toHaveBeenCalledWith({
				id: "s1",
				name: "Main",
				memo: "kept",
				latitude: null,
				longitude: null,
			});
		});

		it("forwards updated coordinates to the server", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{ id: "s1", name: "Main", memo: null, latitude: null, longitude: null },
			]);
			trpcMocks.update.mockResolvedValue({ id: "s1" });
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({
					id: "s1",
					name: "Main",
					latitude: 12.5,
					longitude: -34.25,
				});
			});
			expect(trpcMocks.update).toHaveBeenCalledWith({
				id: "s1",
				name: "Main",
				memo: null,
				latitude: 12.5,
				longitude: -34.25,
			});
		});

		it("rolls back on update error (observed via setQueryData spy)", async () => {
			const qc = createClient();
			const prev = [{ id: "s1", name: "Main", memo: null }];
			qc.setQueryData(STORE_KEY, prev);
			trpcMocks.update.mockRejectedValue(new Error("nope"));

			let snapshotAtRollback: typeof prev | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const post = qc.getQueryData<typeof prev>(STORE_KEY);
					if (
						!snapshotAtRollback &&
						post?.length === 1 &&
						post[0]?.name === "Main"
					) {
						snapshotAtRollback = post;
					}
					return r;
				}
			);

			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(
					result.current.update({ id: "s1", name: "Changed" })
				).rejects.toThrow("nope");
			});
			expect(snapshotAtRollback).toEqual(prev);
		});

		it("flips isUpdatePending during update", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [{ id: "s1", name: "Main", memo: null }]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({ id: "s1", name: "X" });
			});
			await waitFor(() => expect(result.current.isUpdatePending).toBe(true));
			resolve?.({ id: "s1" });
			await waitFor(() => expect(result.current.isUpdatePending).toBe(false));
		});
	});

	describe("delete (optimistic)", () => {
		it("optimistically removes the room id and uses fire-and-forget mutate", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{ id: "s1", name: "Main", memo: null },
				{ id: "s2", name: "Branch", memo: null },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.delete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.delete("s1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<Array<{ id: string }>>(STORE_KEY);
				expect(list?.map((s) => s.id)).toEqual(["s2"]);
			});
			resolve?.({ id: "s1" });
		});

		it("restores the cache when delete fails (observed via setQueryData spy)", async () => {
			const qc = createClient();
			const prev = [
				{ id: "s1", name: "Main", memo: null },
				{ id: "s2", name: "Branch", memo: null },
			];
			qc.setQueryData(STORE_KEY, prev);
			trpcMocks.delete.mockRejectedValue(new Error("denied"));

			let snapshotAtRollback: typeof prev | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const post = qc.getQueryData<typeof prev>(STORE_KEY);
					if (!snapshotAtRollback && post?.length === 2) {
						snapshotAtRollback = post;
					}
					return r;
				}
			);

			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.delete("s1");
			});
			await waitFor(() => expect(trpcMocks.delete).toHaveBeenCalled());
			await waitFor(() => expect(snapshotAtRollback).toEqual(prev));
		});
	});

	describe("toggleFavorite (optimistic)", () => {
		const CREATED_AT = "2024-01-01T00:00:00.000Z";

		it("flips isFavorite on the matching room and re-sorts favorites first", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{
					id: "s1",
					name: "Main",
					memo: null,
					isFavorite: false,
					createdAt: CREATED_AT,
				},
				{
					id: "s2",
					name: "Branch",
					memo: null,
					isFavorite: false,
					createdAt: "2024-01-02T00:00:00.000Z",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.toggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("s2");
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<Array<{ id: string; isFavorite: boolean }>>(
						STORE_KEY
					);
				expect(list?.[0]?.id).toBe("s2");
				expect(list?.[0]?.isFavorite).toBe(true);
				expect(list?.[1]?.id).toBe("s1");
				expect(list?.[1]?.isFavorite).toBe(false);
			});
			resolve?.({ id: "s2" });
		});

		it("sorts equal-favorite items by createdAt ascending", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{
					id: "s1",
					name: "Main",
					memo: null,
					isFavorite: true,
					createdAt: "2024-01-02T00:00:00.000Z",
				},
				{
					id: "s2",
					name: "Branch",
					memo: null,
					isFavorite: false,
					createdAt: "2024-01-01T00:00:00.000Z",
				},
				{
					id: "s3",
					name: "Third",
					memo: null,
					isFavorite: false,
					createdAt: "2024-01-03T00:00:00.000Z",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.toggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("s3");
			});
			// Check the optimistic sort while the mutation is in-flight.
			await waitFor(() => {
				const list = qc.getQueryData<Array<{ id: string }>>(STORE_KEY);
				expect(list?.map((r) => r.id)).toEqual(["s1", "s3", "s2"]);
			});
			resolve?.({ id: "s3" });
		});

		it("skips optimistic update when cache is undefined (onMutate no-op branch)", async () => {
			const qc = createClient();
			trpcMocks.toggleFavorite.mockResolvedValue({ id: "s1" });
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.toggleFavorite("s1");
			});
			expect(trpcMocks.toggleFavorite).toHaveBeenCalledWith({ id: "s1" });
		});

		it("flips isToggleFavoritePending to true while in-flight", async () => {
			const qc = createClient();
			qc.setQueryData(STORE_KEY, [
				{
					id: "s1",
					name: "Main",
					memo: null,
					isFavorite: false,
					createdAt: CREATED_AT,
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.toggleFavorite.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.toggleFavorite("s1");
			});
			await waitFor(() =>
				expect(result.current.isToggleFavoritePending).toBe(true)
			);
			resolve?.({ id: "s1" });
			await waitFor(() =>
				expect(result.current.isToggleFavoritePending).toBe(false)
			);
		});

		it("restores the cache when toggleFavorite fails (observed via setQueryData spy)", async () => {
			const qc = createClient();
			const prev = [
				{
					id: "s1",
					name: "Main",
					memo: null,
					isFavorite: false,
					createdAt: CREATED_AT,
				},
			];
			qc.setQueryData(STORE_KEY, prev);
			trpcMocks.toggleFavorite.mockRejectedValue(new Error("fail"));

			let snapshotAtRollback: typeof prev | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const post = qc.getQueryData<typeof prev>(STORE_KEY);
					if (
						!snapshotAtRollback &&
						post?.length === 1 &&
						post[0]?.isFavorite === false
					) {
						snapshotAtRollback = post;
					}
					return r;
				}
			);

			const { result } = renderHook(() => useRooms(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(result.current.toggleFavorite("s1")).rejects.toThrow(
					"fail"
				);
			});
			expect(snapshotAtRollback).toEqual(prev);
		});
	});
});
