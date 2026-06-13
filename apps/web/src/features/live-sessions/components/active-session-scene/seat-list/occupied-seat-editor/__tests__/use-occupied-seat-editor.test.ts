import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDetailData } from "@/features/players/hooks/use-player-detail";

const mocks = vi.hoisted(() => ({
	detail: {
		availableTags: [
			{ color: "#111111", id: "t1", name: "Fish" },
			{ color: "#222222", id: "t2", name: "Reg" },
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
		tags: [{ color: "#111111", id: "t1", name: "Fish" }],
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

	describe("tag toggling (instant save)", () => {
		it("marks the player's current tags as selected", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			expect(result.current.isTagSelected("t1")).toBe(true);
			expect(result.current.isTagSelected("t2")).toBe(false);
		});

		it("toggling an unselected tag saves the player with it added", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onToggleTag("t2"));
			expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				tagIds: ["t1", "t2"],
			});
		});

		it("toggling a selected tag saves the player with it removed", () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onToggleTag("t1"));
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				tagIds: [],
			});
		});

		it("ignores toggles before the player detail has loaded", () => {
			mocks.detail.player = null;
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.onToggleTag("t1"));
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});
	});

	describe("new tag creation", () => {
		it("creates the tag and assigns it to the player, then clears the input", async () => {
			mocks.detail.createTag.mockResolvedValue({
				color: "#333333",
				id: "t-new",
				name: "Whale",
			});
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.setNewTagName(" Whale "));
			await act(async () => {
				await result.current.onCreateTag();
			});
			expect(mocks.detail.createTag).toHaveBeenCalledTimes(1);
			expect(mocks.detail.createTag).toHaveBeenCalledWith("Whale");
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				tagIds: ["t1", "t-new"],
			});
			expect(result.current.newTagName).toBe("");
		});

		it("does nothing for an empty new-tag name", async () => {
			const { result } = renderHook(() =>
				useOccupiedSeatEditor({ playerId: "p-1" })
			);
			act(() => result.current.setNewTagName("   "));
			await act(async () => {
				await result.current.onCreateTag();
			});
			expect(mocks.detail.createTag).not.toHaveBeenCalled();
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
