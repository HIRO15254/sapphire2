import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const state = vi.hoisted(() => ({
	playerListImpl: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("player", "list", input),
					queryFn: () => state.playerListImpl(input),
				}),
			},
		},
	},
}));

import { useAddPlayerSearch } from "@/features/live-sessions/components/add-player-sheet/use-add-player-search";

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

describe("useAddPlayerSearch", () => {
	it("defaults to empty search, empty tags, and empty players list when closed", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useAddPlayerSearch({ excludePlayerIds: [], open: false }),
			{ wrapper: makeWrapper(qc) }
		);
		expect(result.current.search).toBe("");
		expect(result.current.selectedTags).toEqual([]);
		expect(result.current.selectedTagIds).toEqual([]);
		expect(result.current.filteredPlayers).toEqual([]);
	});

	it("excludes players whose id is in excludePlayerIds", async () => {
		const qc = createClient();
		state.playerListImpl.mockResolvedValue([
			{ id: "p1", name: "Alice" },
			{ id: "p2", name: "Bob" },
		]);
		const { result } = renderHook(
			() => useAddPlayerSearch({ excludePlayerIds: ["p1"], open: true }),
			{ wrapper: makeWrapper(qc) }
		);
		await waitFor(() => expect(result.current.filteredPlayers).toHaveLength(1));
		expect(result.current.filteredPlayers[0].id).toBe("p2");
	});

	it("resets search and tags whenever `open` transitions to true", () => {
		const qc = createClient();
		const { result, rerender } = renderHook(
			(p: { open: boolean }) =>
				useAddPlayerSearch({ excludePlayerIds: [], open: p.open }),
			{ wrapper: makeWrapper(qc), initialProps: { open: true } }
		);
		act(() => {
			result.current.setSearch("Alice");
			result.current.addSelectedTag({ id: "t1", name: "Tag", color: "red" });
		});
		expect(result.current.search).toBe("Alice");
		expect(result.current.selectedTags).toHaveLength(1);

		rerender({ open: false });
		rerender({ open: true });
		expect(result.current.search).toBe("");
		expect(result.current.selectedTags).toEqual([]);
	});

	it("addSelectedTag appends; removeSelectedTag filters by id", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useAddPlayerSearch({ excludePlayerIds: [], open: true }),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.addSelectedTag({ id: "t1", name: "A", color: "red" });
			result.current.addSelectedTag({ id: "t2", name: "B", color: "blue" });
		});
		expect(result.current.selectedTagIds).toEqual(["t1", "t2"]);
		act(() => {
			result.current.removeSelectedTag({
				id: "t1",
				name: "A",
				color: "red",
			});
		});
		expect(result.current.selectedTagIds).toEqual(["t2"]);
	});
});
