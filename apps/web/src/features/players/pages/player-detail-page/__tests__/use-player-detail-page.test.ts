import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	navigate: vi.fn(),
	updatePlayer: vi.fn(),
	deletePlayer: vi.fn(),
	createTag: vi.fn(),
	player: null as {
		id: string;
		memo: string | null;
		name: string;
		tags: Array<{ color: string; id: string; name: string }>;
	} | null,
	availableTags: [] as Array<{ color: string; id: string; name: string }>,
	isLoading: false,
	isInitialLoadError: false,
	onRetry: vi.fn(),
	isSaving: false,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => hoisted.navigate,
}));

vi.mock("@/features/players/hooks/use-player-detail", () => ({
	usePlayerDetail: () => ({
		player: hoisted.player,
		availableTags: hoisted.availableTags,
		createTag: hoisted.createTag,
		isLoading: hoisted.isLoading,
		isInitialLoadError: hoisted.isInitialLoadError,
		onRetry: hoisted.onRetry,
		isSaving: hoisted.isSaving,
		isDeleting: false,
		updatePlayer: hoisted.updatePlayer,
		deletePlayer: hoisted.deletePlayer,
	}),
}));

import { usePlayerDetailPage } from "@/features/players/pages/player-detail-page/use-player-detail-page";

const player = (id: string, name = "Alice") => ({
	id,
	name,
	memo: null,
	tags: [],
});

describe("usePlayerDetailPage", () => {
	beforeEach(() => {
		hoisted.navigate.mockReset();
		hoisted.updatePlayer.mockReset();
		hoisted.deletePlayer.mockReset();
		hoisted.createTag.mockReset();
		hoisted.player = null;
		hoisted.availableTags = [];
		hoisted.isLoading = false;
		hoisted.isInitialLoadError = false;
		hoisted.onRetry.mockReset();
		hoisted.isSaving = false;
	});

	it("exposes the player from the data hook", () => {
		hoisted.player = player("p1", "Bob");
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		expect(result.current.player?.name).toBe("Bob");
	});

	it("forwards isLoading from the data hook", () => {
		hoisted.isLoading = true;
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		expect(result.current.isLoading).toBe(true);
	});

	it("forwards the initial-load error state and retry callback", () => {
		hoisted.isInitialLoadError = true;
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		expect(result.current.isInitialLoadError).toBe(true);
		expect(result.current.onRetry).toBe(hoisted.onRetry);
	});

	it("forwards isSaving and availableTags from the data hook", () => {
		hoisted.isSaving = true;
		hoisted.availableTags = [{ id: "vip", name: "VIP", color: "blue" }];
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		expect(result.current.isSaving).toBe(true);
		expect(result.current.availableTags).toHaveLength(1);
	});

	it("starts with all sheets/dialogs closed", () => {
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.isEditOpen).toBe(false);
		expect(result.current.confirmingDelete).toBe(false);
	});

	it("openEditFromActions closes the drawer and opens the edit sheet", () => {
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		act(() => result.current.setIsActionsOpen(true));
		act(() => result.current.openEditFromActions());
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.isEditOpen).toBe(true);
	});

	it("openDeleteFromActions closes the drawer and opens the confirm dialog", () => {
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		act(() => result.current.setIsActionsOpen(true));
		act(() => result.current.openDeleteFromActions());
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.confirmingDelete).toBe(true);
	});

	it("handleEdit updates the player with the id and closes the edit sheet", () => {
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		act(() => result.current.setIsEditOpen(true));
		act(() =>
			result.current.handleEdit({
				name: "Renamed",
				memo: "note",
				tagIds: ["vip"],
			})
		);
		expect(hoisted.updatePlayer).toHaveBeenCalledTimes(1);
		expect(hoisted.updatePlayer).toHaveBeenCalledWith({
			id: "p1",
			name: "Renamed",
			memo: "note",
			tagIds: ["vip"],
		});
		expect(result.current.isEditOpen).toBe(false);
	});

	it("handleConfirmDelete deletes the player, closes the dialog, and navigates to /players", () => {
		const { result } = renderHook(() => usePlayerDetailPage("p1"));
		act(() => result.current.setConfirmingDelete(true));
		act(() => result.current.handleConfirmDelete());
		expect(hoisted.deletePlayer).toHaveBeenCalledWith("p1");
		expect(result.current.confirmingDelete).toBe(false);
		expect(hoisted.navigate).toHaveBeenCalledWith({ to: "/players" });
	});
});
