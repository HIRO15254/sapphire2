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

import { useJoinSeatSheet } from "../use-join-seat-sheet";

function makeOption(overrides: Partial<PlayerOption> = {}): PlayerOption {
	return { id: "p-1", memo: null, name: "Alice", tags: [], ...overrides };
}

function render(
	overrides: Partial<Parameters<typeof useJoinSeatSheet>[0]> = {}
) {
	const options = {
		excludePlayerIds: [],
		heroAvailable: true,
		onOpenChange: vi.fn(),
		onScan: vi.fn(),
		onSeatExisting: vi.fn(),
		onSeatHero: vi.fn(),
		onSeatNew: vi.fn(),
		onSeatTemporary: vi.fn(),
		seatPosition: 2,
		...overrides,
	};
	return { options, ...renderHook(() => useJoinSeatSheet(options)) };
}

describe("useJoinSeatSheet", () => {
	beforeEach(() => {
		mocks.players = [];
	});

	describe("title", () => {
		it("formats the 1-indexed seat label", () => {
			const { result } = render({ seatPosition: 2 });
			expect(result.current.title).toBe("Sit in at S3");
		});

		it("falls back to a generic title when there is no seat position", () => {
			const { result } = render({ seatPosition: null });
			expect(result.current.title).toBe("Sit in");
		});
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

		it("matches by player name case-insensitively", () => {
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

	describe("create-option presence", () => {
		it("is absent when the query is empty", () => {
			const { result } = render();
			expect(result.current.showCreateOption).toBe(false);
		});

		it("is absent when the query is only whitespace", () => {
			const { result } = render();
			act(() => result.current.setQuery("   "));
			expect(result.current.showCreateOption).toBe(false);
		});

		it("is present when the query has no exact-name match", () => {
			mocks.players = [makeOption({ id: "p-1", name: "Alice" })];
			const { result } = render();
			act(() => result.current.setQuery("Sunglasses"));
			expect(result.current.showCreateOption).toBe(true);
			expect(result.current.trimmedQuery).toBe("Sunglasses");
		});

		it("is absent when the query exactly matches an existing player name", () => {
			mocks.players = [makeOption({ id: "p-1", name: "Alice" })];
			const { result } = render();
			act(() => result.current.setQuery("alice"));
			expect(result.current.showCreateOption).toBe(false);
		});
	});

	describe("hasQuery / clearQuery", () => {
		it("hasQuery is false with an empty query", () => {
			const { result } = render();
			expect(result.current.hasQuery).toBe(false);
		});

		it("hasQuery is true once text is entered", () => {
			const { result } = render();
			act(() => result.current.setQuery("a"));
			expect(result.current.hasQuery).toBe(true);
		});

		it("clearQuery resets the query to empty", () => {
			const { result } = render();
			act(() => result.current.setQuery("a"));
			act(() => result.current.clearQuery());
			expect(result.current.query).toBe("");
		});
	});

	describe("onSelectExisting", () => {
		it("seats the existing player at the seat and closes the sheet", () => {
			const { options, result } = render({ seatPosition: 4 });
			act(() =>
				result.current.onSelectExisting(makeOption({ id: "p-9", name: "Nina" }))
			);
			expect(options.onSeatExisting).toHaveBeenCalledTimes(1);
			expect(options.onSeatExisting).toHaveBeenNthCalledWith(
				1,
				4,
				"p-9",
				"Nina"
			);
			expect(options.onOpenChange).toHaveBeenCalledTimes(1);
			expect(options.onOpenChange).toHaveBeenNthCalledWith(1, false);
		});

		it("does nothing when there is no seat position", () => {
			const { options, result } = render({ seatPosition: null });
			act(() =>
				result.current.onSelectExisting(makeOption({ id: "p-9", name: "Nina" }))
			);
			expect(options.onSeatExisting).not.toHaveBeenCalled();
			expect(options.onOpenChange).not.toHaveBeenCalled();
		});
	});

	describe("onCreate", () => {
		it("seats a temporary player at the seat and closes the sheet", () => {
			const { options, result } = render({ seatPosition: 1 });
			act(() => result.current.setQuery("Sunglasses"));
			act(() => result.current.onCreate());
			expect(options.onSeatTemporary).toHaveBeenCalledTimes(1);
			expect(options.onSeatTemporary).toHaveBeenNthCalledWith(1, 1);
			expect(options.onOpenChange).toHaveBeenCalledTimes(1);
			expect(options.onOpenChange).toHaveBeenNthCalledWith(1, false);
		});

		it("is a no-op when the query is blank", () => {
			const { options, result } = render({ seatPosition: 1 });
			act(() => result.current.setQuery("   "));
			act(() => result.current.onCreate());
			expect(options.onSeatTemporary).not.toHaveBeenCalled();
			expect(options.onOpenChange).not.toHaveBeenCalled();
		});

		it("is a no-op when there is no seat position", () => {
			const { options, result } = render({ seatPosition: null });
			act(() => result.current.setQuery("Sunglasses"));
			act(() => result.current.onCreate());
			expect(options.onSeatTemporary).not.toHaveBeenCalled();
			expect(options.onOpenChange).not.toHaveBeenCalled();
		});
	});

	describe("onToggleHero", () => {
		it("claims the seat for the hero and closes the sheet when turned on", () => {
			const { options, result } = render({ seatPosition: 3 });
			act(() => result.current.onToggleHero(true));
			expect(options.onSeatHero).toHaveBeenCalledTimes(1);
			expect(options.onSeatHero).toHaveBeenNthCalledWith(1, 3);
			expect(options.onOpenChange).toHaveBeenCalledTimes(1);
			expect(options.onOpenChange).toHaveBeenNthCalledWith(1, false);
		});

		it("does nothing when turned off", () => {
			const { options, result } = render({ seatPosition: 3 });
			act(() => result.current.onToggleHero(false));
			expect(options.onSeatHero).not.toHaveBeenCalled();
			expect(options.onOpenChange).not.toHaveBeenCalled();
		});

		it("does nothing when there is no seat position", () => {
			const { options, result } = render({ seatPosition: null });
			act(() => result.current.onToggleHero(true));
			expect(options.onSeatHero).not.toHaveBeenCalled();
			expect(options.onOpenChange).not.toHaveBeenCalled();
		});
	});

	describe("onScanClick", () => {
		it("calls onScan once and closes the sheet", () => {
			const { options, result } = render();
			act(() => result.current.onScanClick());
			expect(options.onScan).toHaveBeenCalledTimes(1);
			expect(options.onOpenChange).toHaveBeenCalledTimes(1);
			expect(options.onOpenChange).toHaveBeenNthCalledWith(1, false);
		});
	});
});
