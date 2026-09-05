import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerDetailData } from "@/features/players/hooks/use-player-detail";
import type { PlayerPanelSelection } from "../use-player-panel";

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

import { usePlayerPanel } from "../use-player-panel";

function makeSelection(
	overrides: Partial<PlayerPanelSelection> = {}
): PlayerPanelSelection {
	return {
		playerId: "p-1",
		playerName: "Alice",
		seatPosition: 0,
		...overrides,
	};
}

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

describe("usePlayerPanel", () => {
	beforeEach(() => {
		mocks.detail.player = makeDetailPlayer();
		mocks.detail.isSaving = false;
		mocks.detail.updatePlayer.mockReset();
		mocks.detail.createTag.mockReset();
		mocks.usePlayerDetailSpy.mockReset();
	});

	it("loads the player detail for the selected playerId", () => {
		renderHook(() =>
			usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
		);
		expect(mocks.usePlayerDetailSpy).toHaveBeenCalledWith("p-1");
	});

	it("loads the player detail with null when there is no selection", () => {
		renderHook(() => usePlayerPanel({ onLeave: vi.fn(), selection: null }));
		expect(mocks.usePlayerDetailSpy).toHaveBeenCalledWith(null);
	});

	describe("seatLabel", () => {
		it("formats the 1-indexed seat label from the selection", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({
					onLeave: vi.fn(),
					selection: makeSelection({ seatPosition: 3 }),
				})
			);
			expect(result.current.seatLabel).toBe("S4");
		});

		it("is null when there is no selection", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: null })
			);
			expect(result.current.seatLabel).toBeNull();
		});
	});

	describe("tag picker wiring", () => {
		it("onAddTag appends the tag id to the player's tags and saves", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
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
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() =>
				result.current.onAddTag({ color: "gray", id: "t1", name: "Fish" })
			);
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("onRemoveTag drops the tag id and saves", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() =>
				result.current.onRemoveTag({ color: "gray", id: "t1", name: "Fish" })
			);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				tagIds: [],
			});
		});

		it("exposes createTag for the picker's create flow", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			expect(result.current.createTag).toBe(mocks.detail.createTag);
		});

		it("ignores tag changes before the player detail has loaded", () => {
			mocks.detail.player = null;
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() =>
				result.current.onAddTag({ color: "red", id: "t2", name: "Reg" })
			);
			act(() =>
				result.current.onRemoveTag({ color: "gray", id: "t1", name: "Fish" })
			);
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("ignores tag changes when there is no selection", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: null })
			);
			act(() =>
				result.current.onAddTag({ color: "red", id: "t2", name: "Reg" })
			);
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});
	});

	describe("name save-on-blur", () => {
		it("saves a changed, trimmed name", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() => result.current.onNameBlur("  Alice 2  "));
			expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				name: "Alice 2",
			});
		});

		it("skips saving when the name is unchanged", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() => result.current.onNameBlur("Alice"));
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("skips saving an empty name", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() => result.current.onNameBlur("   "));
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});
	});

	describe("memo save-on-blur", () => {
		it("saves the latest memo html when it changed", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
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
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() => result.current.onMemoChange("<p>old</p>"));
			act(() => result.current.onMemoBlur());
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("skips saving when the memo was never edited", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() => result.current.onMemoBlur());
			expect(mocks.detail.updatePlayer).not.toHaveBeenCalled();
		});

		it("saves a cleared memo as null", () => {
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			act(() => result.current.onMemoChange(""));
			act(() => result.current.onMemoBlur());
			expect(mocks.detail.updatePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.detail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				memo: null,
			});
		});
	});

	describe("onLeaveClick", () => {
		it("calls onLeave once with the current selection", () => {
			const onLeave = vi.fn();
			const selection = makeSelection();
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave, selection })
			);
			act(() => result.current.onLeaveClick());
			expect(onLeave).toHaveBeenCalledTimes(1);
			expect(onLeave).toHaveBeenNthCalledWith(1, selection);
		});

		it("does nothing when there is no selection", () => {
			const onLeave = vi.fn();
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave, selection: null })
			);
			act(() => result.current.onLeaveClick());
			expect(onLeave).not.toHaveBeenCalled();
		});
	});

	it("exposes player, availableTags and isSaving", () => {
		mocks.detail.isSaving = true;
		const { result } = renderHook(() =>
			usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
		);
		expect(result.current.player).toBe(mocks.detail.player);
		expect(result.current.availableTags).toBe(mocks.detail.availableTags);
		expect(result.current.isSaving).toBe(true);
	});

	describe("dotColor", () => {
		it("derives the dot color from the selected player's first tag", () => {
			mocks.detail.player = makeDetailPlayer({
				tags: [{ color: "red", id: "t2", name: "Reg" }],
			});
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			expect(result.current.dotColor).toBe("var(--destructive)");
		});

		it("falls back to the default dot color when the player has no tags", () => {
			mocks.detail.player = makeDetailPlayer({ tags: [] });
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			expect(result.current.dotColor).toBe("var(--muted-foreground)");
		});

		it("falls back to the default dot color while the player detail is loading", () => {
			mocks.detail.player = null;
			const { result } = renderHook(() =>
				usePlayerPanel({ onLeave: vi.fn(), selection: makeSelection() })
			);
			expect(result.current.dotColor).toBe("var(--muted-foreground)");
		});
	});
});
