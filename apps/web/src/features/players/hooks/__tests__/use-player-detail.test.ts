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
	playerUpdate: vi.fn(),
	tagCreate: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			getById: {
				queryOptions: (input: { id: string }) => ({
					queryKey: buildKey("player", "getById", input),
					queryFn: () => Promise.resolve(null),
				}),
			},
			list: {
				queryOptions: () => ({
					queryKey: buildKey("player", "list", undefined),
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
			update: { mutate: trpcMocks.playerUpdate },
		},
		playerTag: {
			create: { mutate: trpcMocks.tagCreate },
		},
	},
}));

import {
	type PlayerDetailData,
	type PlayerListItemWithTags,
	type PlayerTagQueryItem,
	usePlayerDetail,
} from "@/features/players/hooks/use-player-detail";

const playerKey = (id: string) => ["player", "getById", { id }];
const PLAYER_LIST_KEY = ["player", "list"];
const TAG_LIST_KEY = ["playerTag", "list"];

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: Number.POSITIVE_INFINITY,
				staleTime: Number.POSITIVE_INFINITY,
			},
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("usePlayerDetail", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state with playerId=null (disabled)", () => {
		it("returns player=null, empty tags, and isSaving=false", () => {
			const qc = createClient();
			const { result } = renderHook(() => usePlayerDetail(null), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.player).toBeNull();
			expect(result.current.availableTags).toEqual([]);
			expect(result.current.isSaving).toBe(false);
		});
	});

	describe("with playerId", () => {
		it("returns the seeded player from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(playerKey("p1"), {
				id: "p1",
				name: "Alice",
				memo: null,
				tags: [],
			} satisfies PlayerDetailData);
			const { result } = renderHook(() => usePlayerDetail("p1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.player?.name).toBe("Alice"));
		});

		it("returns availableTags from the playerTag cache", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
			]);
			const { result } = renderHook(() => usePlayerDetail("p1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.availableTags).toHaveLength(1));
		});
	});

	describe("updatePlayer (optimistic)", () => {
		it("patches the detail cache and the list cache with resolved tags", async () => {
			const qc = createClient();
			qc.setQueryData(playerKey("p1"), {
				id: "p1",
				name: "Alice",
				memo: null,
				tags: [],
			} satisfies PlayerDetailData);
			qc.setQueryData(PLAYER_LIST_KEY, [
				{
					id: "p1",
					name: "Alice",
					memo: null,
					tags: [],
				} satisfies PlayerListItemWithTags,
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
			const { result } = renderHook(() => usePlayerDetail("p1"), {
				wrapper: makeWrapper(qc),
			});
			// Ensure the query is mounted before mutating so setQueriesData can find it.
			await waitFor(() => expect(result.current.player?.name).toBe("Alice"));
			act(() => {
				result.current.updatePlayer({
					id: "p1",
					name: "New Alice",
					memo: "note",
					tagIds: ["vip"],
				});
			});
			await waitFor(() => {
				const detail = qc.getQueryData<PlayerDetailData>(playerKey("p1"));
				expect(detail?.name).toBe("New Alice");
				expect(detail?.memo).toBe("note");
				expect(detail?.tags).toEqual([
					{ id: "vip", name: "VIP", color: "blue" },
				]);
			});
			const list = qc.getQueryData<PlayerListItemWithTags[]>(PLAYER_LIST_KEY);
			expect(list?.[0]?.name).toBe("New Alice");
			expect(list?.[0]?.tags).toEqual([
				{ id: "vip", name: "VIP", color: "blue" },
			]);
			resolve?.({ id: "p1" });
		});

		it("keeps existing tags when tagIds is omitted", async () => {
			const qc = createClient();
			const prev: PlayerDetailData = {
				id: "p1",
				name: "Alice",
				memo: "m",
				tags: [{ id: "vip", name: "VIP", color: "blue" }],
			};
			qc.setQueryData(playerKey("p1"), prev);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerDetail("p1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.updatePlayer({ id: "p1", name: "Alice 2" });
			});
			await waitFor(() => {
				const detail = qc.getQueryData<PlayerDetailData>(playerKey("p1"));
				expect(detail?.name).toBe("Alice 2");
				expect(detail?.tags).toEqual([
					{ id: "vip", name: "VIP", color: "blue" },
				]);
			});
			resolve?.({ id: "p1" });
		});

		it("flips isSaving during update", async () => {
			const qc = createClient();
			qc.setQueryData(playerKey("p1"), {
				id: "p1",
				name: "Alice",
				memo: null,
				tags: [],
			} satisfies PlayerDetailData);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.playerUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerDetail("p1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.updatePlayer({ id: "p1", name: "X" });
			});
			await waitFor(() => expect(result.current.isSaving).toBe(true));
			resolve?.({ id: "p1" });
			await waitFor(() => expect(result.current.isSaving).toBe(false));
		});
	});

	describe("createTag", () => {
		it("appends an optimistic tag with temp-tag- id during mutation", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{
					id: "vip",
					name: "VIP",
					color: "blue",
					createdAt: "x",
					updatedAt: "x",
					userId: "u",
				} satisfies PlayerTagQueryItem,
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tagCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerDetail("p1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.createTag("New");
			});
			await waitFor(() => {
				const tags = qc.getQueryData<PlayerTagQueryItem[]>(TAG_LIST_KEY);
				expect(tags).toHaveLength(2);
				const newTag = tags?.find((t) => t.id.startsWith("temp-tag-"));
				expect(newTag?.name).toBe("New");
				expect(newTag?.color).toBe("gray");
			});
			resolve?.({ id: "new-id", name: "New", color: "red" });
		});

		it("awaits the mutation and returns the compact tag shape", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, []);
			trpcMocks.tagCreate.mockResolvedValue({
				id: "tag-1",
				name: "NewTag",
				color: "red",
			});
			const { result } = renderHook(() => usePlayerDetail("p1"), {
				wrapper: makeWrapper(qc),
			});
			let created: { id: string; name: string; color: string } | undefined;
			await act(async () => {
				created = await result.current.createTag("NewTag");
			});
			expect(created?.id).toBe("tag-1");
			expect(created?.name).toBe("NewTag");
			expect(created?.color).toBe("red");
		});
	});
});
