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
	tagCreate: vi.fn(),
	tagUpdate: vi.fn(),
	tagDelete: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		playerTag: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("playerTag", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		player: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("player", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		playerTag: {
			create: { mutate: trpcMocks.tagCreate },
			update: { mutate: trpcMocks.tagUpdate },
			delete: { mutate: trpcMocks.tagDelete },
		},
	},
}));

import {
	type TagItem,
	usePlayerTags,
} from "@/features/players/hooks/use-player-tags";

const TAG_LIST_KEY = ["playerTag", "list"];
const PLAYER_LIST_KEY = ["player", "list"];

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

describe("usePlayerTags", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns empty tag list and all pending flags false", () => {
			const qc = createClient();
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.tags).toEqual([]);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isDeletePending).toBe(false);
		});

		it("exposes seeded tags from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
				{ id: "reg", name: "Regular", color: "red" },
			]);
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.tags).toHaveLength(2));
		});
	});

	describe("create (optimistic)", () => {
		it("appends a temp-prefixed tag to the cache during create", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tagCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.tags).toHaveLength(1));
			act(() => {
				result.current.create({ name: "New", color: "green" });
			});
			await waitFor(() => {
				const list = qc.getQueryData<TagItem[]>(TAG_LIST_KEY);
				expect(list).toHaveLength(2);
				const newTag = list?.find((t) => t.id.startsWith("temp-tag-"));
				expect(newTag?.name).toBe("New");
				expect(newTag?.color).toBe("green");
			});
			resolve?.({ id: "real", name: "New", color: "green" });
		});

		it("flips isCreatePending during create", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tagCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create({ name: "X", color: "gray" });
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolve?.({ id: "x", name: "X", color: "gray" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));
		});
	});

	describe("update (optimistic)", () => {
		it("patches the tag name and color in the tag list and in each player's tag array", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
			]);
			qc.setQueryData(PLAYER_LIST_KEY, [
				{
					id: "p1",
					tags: [{ id: "vip", name: "VIP", color: "blue" }],
				},
				{ id: "p2", tags: [] },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tagUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.tags).toHaveLength(1));
			act(() => {
				result.current.update({ id: "vip", name: "Elite", color: "yellow" });
			});
			await waitFor(() => {
				const tags = qc.getQueryData<TagItem[]>(TAG_LIST_KEY);
				expect(tags?.[0]?.name).toBe("Elite");
				expect(tags?.[0]?.color).toBe("yellow");
			});
			const players =
				qc.getQueryData<Array<{ tags: TagItem[] }>>(PLAYER_LIST_KEY);
			expect(players?.[0]?.tags?.[0]?.name).toBe("Elite");
			expect(players?.[1]?.tags).toEqual([]);
			resolve?.({ id: "vip" });
		});

		it("leaves unrelated tags untouched", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
				{ id: "reg", name: "Regular", color: "red" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tagUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.tags).toHaveLength(2));
			act(() => {
				result.current.update({ id: "vip", name: "ELITE", color: "yellow" });
			});
			await waitFor(() => {
				const tags = qc.getQueryData<TagItem[]>(TAG_LIST_KEY);
				expect(tags?.find((t) => t.id === "reg")?.name).toBe("Regular");
			});
			resolve?.({ id: "vip" });
		});
	});

	describe("delete (optimistic)", () => {
		it("removes the tag from the tag list and strips it from each player's tags", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
				{ id: "reg", name: "Regular", color: "red" },
			]);
			qc.setQueryData(PLAYER_LIST_KEY, [
				{
					id: "p1",
					tags: [
						{ id: "vip", name: "VIP", color: "blue" },
						{ id: "reg", name: "Regular", color: "red" },
					],
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tagDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.tags).toHaveLength(2));
			act(() => {
				result.current.delete("vip");
			});
			await waitFor(() => {
				const tags = qc.getQueryData<TagItem[]>(TAG_LIST_KEY);
				expect(tags?.map((t) => t.id)).toEqual(["reg"]);
			});
			const players =
				qc.getQueryData<Array<{ tags: TagItem[] }>>(PLAYER_LIST_KEY);
			expect(players?.[0]?.tags.map((t) => t.id)).toEqual(["reg"]);
			resolve?.({ id: "vip" });
		});

		it("flips isDeletePending during delete", async () => {
			const qc = createClient();
			qc.setQueryData(TAG_LIST_KEY, [
				{ id: "vip", name: "VIP", color: "blue" },
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tagDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => usePlayerTags(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.delete("vip");
			});
			await waitFor(() => expect(result.current.isDeletePending).toBe(true));
			resolve?.({ id: "vip" });
			await waitFor(() => expect(result.current.isDeletePending).toBe(false));
		});
	});
});
