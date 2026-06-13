import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDetailData } from "@/features/players/hooks/use-player-detail";

const mocks = vi.hoisted(() => ({
	detail: {
		availableTags: [
			{ color: "gray", id: "t1", name: "Fish" },
			{ color: "red", id: "t2", name: "Reg" },
		],
		createTag: vi.fn(),
		isSaving: false,
		player: null as PlayerDetailData | null,
		updatePlayer: vi.fn(),
	},
	usePlayerDetailSpy: vi.fn(),
}));

vi.mock("@/features/players/hooks/use-player-detail", () => ({
	usePlayerDetail: (playerId: string | null) => {
		mocks.usePlayerDetailSpy(playerId);
		return mocks.detail;
	},
}));

import { useOccupiedSeatEditor } from "@/features/live-sessions/components/active-session-scene/seat-list/occupied-seat-editor/use-occupied-seat-editor";

function makeDetailPlayer(
	overrides: Partial<PlayerDetailData> = {}
): PlayerDetailData {
	return {
		id: "p-1",
		memo: "<p>old</p>",
		name: "Alice",
		tags: [{ color: "gray", id: "t1", name: "Fish" }],
		...overrides,
	};
}

describe("useOccupiedSeatEditor", () => {
	beforeEach(() => {
		mocks.detail.player = makeDetailPlayer();
		mocks.detail.isSaving = false;
		mocks.detail.updatePlayer.mockReset();
		mocks.detail.createTag.mockReset();
		mocks.usePlayerDetailSpy.mockReset();
	});

	it("loads the detail for the given playerId", () => {
		renderHook(() => useOccupiedSeatEditor({ playerId: "p-1" }));
		expect(mocks.usePlayerDetailSpy).toHaveBeenCalledWith("p-1");
	});

	describe("tag picker wiring", () => {
		it("onAddTag appends the tag id to the player's tags and saves", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() =>
				result.current.onAddTag({ color: "red", id: "t2", name: "Reg" })
			);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				tagIds: ["t1", "t2"],
			});
		});

		it("onAddTag ignores a tag the player already has", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() =>
				result.current.onAddTag({ color: "gray", id: "t1", name: "Fish" })
			);
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("onRemoveTag drops the tag id and saves", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() =>
				result.current.onRemoveTag({ color: "gray", id: "t1", name: "Fish" })
			);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				tagIds: [],
			});
		});

		it("exposes createTag for the picker's create flow", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			expect(result.current.createTag).toBe(mocks.detail.createTag);
		});

		it("ignores tag changes before the player detail has loaded", () => {
			mocks.detail.player = null;
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() =>
				result.current.onAddTag({ color: "red", id: "t2", name: "Reg" })
			);
			act(() =>
				result.current.onRemoveTag({ color: "gray", id: "t1", name: "Fish" })
			);
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});
	});

	describe("name save-on-blur", () => {
		it("saves a changed, trimmed name", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onNameBlur("  Alice 2  "));
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				name: "Alice 2",
			});
		});

		it("skips saving when the name is unchanged", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onNameBlur("Alice"));
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("skips saving an empty name", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onNameBlur("   "));
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});
	});

	describe("memo save-on-blur", () => {
		it("saves the latest memo html when it changed", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onMemoChange("<p>new note</p>"));
			act(() => result.current.onMemoBlur());
			expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				memo: "<p>new note</p>",
			});
		});

		it("skips saving when the memo did not change", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onMemoChange("<p>old</p>"));
			act(() => result.current.onMemoBlur());
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("skips saving when the memo was never edited", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onMemoBlur());
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("saves a cleared memo as null", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onMemoChange(""));
			act(() => result.current.onMemoBlur());
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				memo: null,
			});
		});
	});

	it("exposes player, availableTags and isSaving", () => {
		mocks.detail.isSaving = true;
		const { result } = renderHook(() =>
			useOccupiedSeatEditor({ playerId: "p-1" })
		);
		expect(result.current.player).toBe(mocks.detail.player);
		expect(result.current.availableTags).toBe(mocks.detail.availableTags);
		expect(result.current.isSaving).toBe(true);
	});
});
