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
	playerCreate: vi.fn(),
	playerUpdate: vi.fn(),
	playerDelete: vi.fn(),
	tagCreate: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey:
						input === undefined
							? buildKey("player", "list", undefined)
							: buildKey("player", "list", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		playerTag: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("playerTag", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		player: {
			create: { mutate: trpcMocks.playerCreate },
			update: { mutate: trpcMocks.playerUpdate },
			delete: { mutate: trpcMocks.playerDelete },
		},
		playerTag: {
			create: { mutate: trpcMocks.tagCreate },
		},
	},
}));

import {
	type PlayerItem,
	usePlayers,
} from "@/features/players/hooks/use-players";

const PLAYER_LIST_ALL_KEY = ["player", "list"];
const PLAYER_LIST_FILTERED_KEY = (tagIds: string[]) => [
	"player",
	"list",
	{ tagIds },
];
const TAG_LIST_KEY = ["playerTag", "list"];

function makePlayer(overrides: Partial<PlayerItem> = {}): PlayerItem {
	return {
		id: "p1",
		name: "Alice",
		memo: null,
		tags: [],
		isTemporary: false,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		userId: "u",
		...overrides,
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

describe("usePlayers", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("query key selection by filterTagIds", () => {
		it("uses the unfiltered queryKey when filterTagIds is empty", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, [makePlayer({ id: "p1" })]);
			qc.setQueryData(PLAYER_LIST_FILTERED_KEY(["vip"]), [
				makePlayer({ id: "filtered" }),
			]);
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.players.map((p) => p.id)).toEqual(["p1"])
			);
		});

		it("uses the filtered queryKey when tagIds is non-empty", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, [makePlayer({ id: "p1" })]);
			qc.setQueryData(PLAYER_LIST_FILTERED_KEY(["vip"]), [
				makePlayer({ id: "filtered" }),
			]);
			const { result } = renderHook(() => usePlayers(["vip"]), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.players.map((p) => p.id)).toEqual(["filtered"])
			);
		});
	});

	describe("availableTags", () => {
		it("exposes seeded tags from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
			]);
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.availableTags).toHaveLength(1));
		});
	});

	describe("create (optimistic)", () => {
		it("appends a temp player with resolved tags during in-flight create", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, [makePlayer({ id: "p1" })]);
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
				{ id: "reg", name: "Regular", color: "red" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({ name: "Bob", memo: null, tagIds: ["vip"] });
			});
			await waitFor(() => {
				const list = qc.getQueryData<PlayerItem[]>(PLAYER_LIST_ALL_KEY);
				expect(list).toHaveLength(2);
				const temp = list?.find((p) => p.id.startsWith("temp-"));
				expect(temp?.name).toBe("Bob");
				expect(temp?.tags).toEqual([{ id: "vip", name: "VIP", color: "blue" }]);
			});
			resolve?.({ id: "p2" });
		});

		it("forwards memo=undefined when memo is null on the form side", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, []);
			trpcMocks.playerCreate.mockResolvedValue({ id: "new" });
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({ name: "NoMemo", memo: null });
			});
			expect(trpcMocks.playerCreate).toHaveBeenCalledWith({
				name: "NoMemo",
				memo: undefined,
			});
		});

		it("onMutate no-ops when cache is undefined (old === undefined branch)", async () => {
			const qc = createClient();
			trpcMocks.playerCreate.mockResolvedValue({ id: "new" });
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create({ name: "Free" });
			});
			expect(trpcMocks.playerCreate).toHaveBeenCalledWith({
				name: "Free",
				memo: undefined,
			});
		});

		it("flips isCreatePending during in-flight create", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({ name: "X" });
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolve?.({ id: "x" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));
		});
	});

	describe("update (optimistic)", () => {
		it("patches name, memo, and resolves tag names from availableTags", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, [
				makePlayer({ id: "p1", name: "Old", memo: null, tags: [] }),
			]);
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({
					id: "p1",
					name: "New",
					memo: "notes",
					tagIds: ["vip"],
				});
			});
			await waitFor(() => {
				const list = qc.getQueryData<PlayerItem[]>(PLAYER_LIST_ALL_KEY);
				expect(list?.[0]?.name).toBe("New");
				expect(list?.[0]?.memo).toBe("notes");
				expect(list?.[0]?.tags).toEqual([
					{ id: "vip", name: "VIP", color: "blue" },
				]);
			});
			resolve?.({ id: "p1" });
		});

		it("preserves existing tags when tagIds is omitted", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, [
				makePlayer({
					id: "p1",
					name: "Alice",
					memo: "m",
					tags: [{ id: "vip", name: "VIP", color: "blue" }],
				}),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({ id: "p1", name: "Alice 2" });
			});
			await waitFor(() => {
				const list = qc.getQueryData<PlayerItem[]>(PLAYER_LIST_ALL_KEY);
				expect(list?.[0]?.name).toBe("Alice 2");
				expect(list?.[0]?.tags).toEqual([
					{ id: "vip", name: "VIP", color: "blue" },
				]);
			});
			resolve?.({ id: "p1" });
		});

		it("does not modify other players during a targeted update", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_ALL_KEY, [
				makePlayer({ id: "p1", name: "Alice" }),
				makePlayer({ id: "p2", name: "Bob" }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({ id: "p1", name: "A2" });
			});
			await waitFor(() => {
				const list = qc.getQueryData<PlayerItem[]>(PLAYER_LIST_ALL_KEY);
				expect(list?.find((p) => p.id === "p2")?.name).toBe("Bob");
			});
			resolve?.({ id: "p1" });
		});
	});

	describe("delete (optimistic)", () => {
		it("optimistically removes the player id from the filtered list", async () => {
			const qc = createClient();
			qc.setQueryData(PLAYER_LIST_FILTERED_KEY(["vip"]), [
				makePlayer({ id: "p1" }),
				makePlayer({ id: "p2" }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayers(["vip"]), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.delete("p1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<PlayerItem[]>(
					PLAYER_LIST_FILTERED_KEY(["vip"])
				);
				expect(list?.map((p) => p.id)).toEqual(["p2"]);
			});
			resolve?.({ id: "p1" });
		});
	});

	describe("createTag", () => {
		it("creates a tag and invalidates the tag list; returns the compact shape", async () => {
			const qc = createClient();
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.tagCreate.mockResolvedValue({
				id: "tag-new",
				name: "New Tag",
				color: "green",
				createdAt: "x",
			});
			const { result } = renderHook(() => usePlayers([]), {
				wrapper: makeWrapper(qc),
			});
			let created: { id: string; name: string; color: string } | undefined;
			await act(async () => {
				created = await result.current.createTag("New Tag");
			});
			expect(trpcMocks.tagCreate).toHaveBeenCalledWith({ name: "New Tag" });
			expect(created).toEqual({
				id: "tag-new",
				name: "New Tag",
				color: "green",
			});
			const keys = invalidateSpy.mock.calls.map(
				(c) => (c[0] as { queryKey: unknown[] } | undefined)?.queryKey
			);
			expect(keys).toEqual(expect.arrayContaining([TAG_LIST_KEY]));
		});
	});
});
