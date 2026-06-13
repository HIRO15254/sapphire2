import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface PlayerOption {
	id: string;
	memo: string | null;
	name: string;
	tags: { color: string; id: string; name: string }[];
}

const mocks = vi.hoisted(() => ({
	players: [] as PlayerOption[],
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: mocks.players }),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: { queryOptions: () => ({ queryKey: ["player", "list"] }) },
		},
	},
}));

import { useEmptySeatEditor } from "@/features/live-sessions/components/active-session-scene/seat-list/empty-seat-editor/use-empty-seat-editor";

function makeOption(overrides: Partial<PlayerOption> = {}): PlayerOption {
	return { id: "p-1", memo: null, name: "Alice", tags: [], ...overrides };
}

function render(
	overrides: Partial<Parameters<typeof useEmptySeatEditor>[0]> = {}
) {
	const options = {
		excludePlayerIds: [],
		onAddExisting: vi.fn(),
		onAddNew: vi.fn(),
		onAddTemporary: vi.fn(),
		...overrides,
	};
	return { options, ...renderHook(() => useEmptySeatEditor(options)) };
}

describe("useEmptySeatEditor", () => {
	beforeEach(() => {
		mocks.players = [];
	});

	describe("filtering", () => {
		it("returns all non-excluded players when the query is empty", () => {
			mocks.players = [
				makeOption({ id: "p-1", name: "Alice" }),
				makeOption({ id: "p-2", name: "Bob" }),
			];
			const { result } = render({ excludePlayerIds: ["p-2"] });
			expect(result.current.matches.map((p) => p.id)).toEqual(["p-1"]);
		});

		it("matches by player name (case-insensitive)", () => {
			mocks.players = [
				makeOption({ id: "p-1", name: "Alice" }),
				makeOption({ id: "p-2", name: "Bob" }),
			];
			const { result } = render();
			act(() => result.current.setQuery("ALI"));
			expect(result.current.matches.map((p) => p.id)).toEqual(["p-1"]);
		});

		it("matches by tag name", () => {
			mocks.players = [
				makeOption({
					id: "p-1",
					name: "Alice",
					tags: [{ color: "#f00", id: "t1", name: "Whale" }],
				}),
				makeOption({ id: "p-2", name: "Bob" }),
			];
			const { result } = render();
			act(() => result.current.setQuery("whal"));
			expect(result.current.matches.map((p) => p.id)).toEqual(["p-1"]);
		});

		it("never includes excluded (already-seated) players", () => {
			mocks.players = [makeOption({ id: "p-1", name: "Alice" })];
			const { result } = render({ excludePlayerIds: ["p-1"] });
			act(() => result.current.setQuery("ali"));
			expect(result.current.matches).toHaveLength(0);
		});
	});

	describe("create affordance", () => {
		it("canCreate is false with an empty query", () => {
			const { result } = render();
			expect(result.current.canCreate).toBe(false);
		});

		it("canCreate is true once the query has non-space text", () => {
			const { result } = render();
			act(() => result.current.setQuery("  Nina  "));
			expect(result.current.canCreate).toBe(true);
			expect(result.current.trimmed).toBe("Nina");
		});
	});

	describe("handlers", () => {
		it("onSelectExisting seats the player and resets the field", () => {
			const { options, result } = render();
			act(() => result.current.setQuery("ali"));
			act(() => result.current.setOpen(true));
			act(() =>
				result.current.onSelectExisting(makeOption({ id: "p-9", name: "Nina" }))
			);
			expect(options.onAddExisting).toHaveBeenCalledWith("p-9", "Nina");
			expect(result.current.query).toBe("");
			expect(result.current.open).toBe(false);
		});

		it("onCreate seats a new player with the trimmed query", () => {
			const { options, result } = render();
			act(() => result.current.setQuery("  Nina  "));
			act(() => result.current.onCreate());
			expect(options.onAddNew).toHaveBeenCalledWith({ name: "Nina" });
			expect(result.current.query).toBe("");
		});

		it("onCreate is a no-op when the query is blank", () => {
			const { options, result } = render();
			act(() => result.current.setQuery("   "));
			act(() => result.current.onCreate());
			expect(options.onAddNew).not.toHaveBeenCalled();
		});

		it("onTemporary seats a temp player and resets", () => {
			const { options, result } = render();
			act(() => result.current.setQuery("x"));
			act(() => result.current.onTemporary());
			expect(options.onAddTemporary).toHaveBeenCalledTimes(1);
			expect(result.current.query).toBe("");
			expect(result.current.open).toBe(false);
		});
	});
});
