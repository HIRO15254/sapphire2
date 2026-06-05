import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	navigate: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
	toggleFavorite: vi.fn(),
	rooms: [] as Array<{
		id: string;
		memo?: string | null;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	}>,
	isLoading: false,
	isUpdatePending: false,
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => hoisted.navigate,
}));

vi.mock("@/features/rooms/hooks/use-rooms", () => ({
	useRooms: () => ({
		rooms: hoisted.rooms,
		isLoading: hoisted.isLoading,
		isUpdatePending: hoisted.isUpdatePending,
		isCreatePending: false,
		isToggleFavoritePending: false,
		create: vi.fn(),
		update: hoisted.update,
		delete: hoisted.del,
		toggleFavorite: hoisted.toggleFavorite,
	}),
}));

import { useRoomDetailPage } from "@/features/rooms/pages/room-detail-page/use-room-detail-page";

const room = (id: string, name = "Akiba") => ({
	id,
	name,
	memo: null,
	ringGameCount: 0,
	tournamentCount: 0,
});

describe("useRoomDetailPage", () => {
	beforeEach(() => {
		hoisted.navigate.mockReset();
		hoisted.update.mockReset().mockResolvedValue({ id: "s1" });
		hoisted.del.mockReset();
		hoisted.toggleFavorite.mockReset().mockResolvedValue({ id: "s1" });
		hoisted.rooms = [];
		hoisted.isLoading = false;
		hoisted.isUpdatePending = false;
	});

	it("finds the room matching the id from the list", () => {
		hoisted.rooms = [room("s1"), room("s2", "Shinjuku")];
		const { result } = renderHook(() => useRoomDetailPage("s2"));
		expect(result.current.room?.name).toBe("Shinjuku");
	});

	it("returns null room when the id is not in the list", () => {
		hoisted.rooms = [room("s1")];
		const { result } = renderHook(() => useRoomDetailPage("missing"));
		expect(result.current.room).toBeNull();
	});

	it("forwards isLoading from the data hook", () => {
		hoisted.isLoading = true;
		const { result } = renderHook(() => useRoomDetailPage("s1"));
		expect(result.current.isLoading).toBe(true);
	});

	it("starts with all sheets/dialogs closed", () => {
		const { result } = renderHook(() => useRoomDetailPage("s1"));
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.isEditOpen).toBe(false);
		expect(result.current.confirmingDelete).toBe(false);
	});

	it("openEditFromActions closes the drawer and opens the edit sheet", () => {
		const { result } = renderHook(() => useRoomDetailPage("s1"));
		act(() => result.current.setIsActionsOpen(true));
		act(() => result.current.openEditFromActions());
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.isEditOpen).toBe(true);
	});

	it("openDeleteFromActions closes the drawer and opens the confirm dialog", () => {
		const { result } = renderHook(() => useRoomDetailPage("s1"));
		act(() => result.current.setIsActionsOpen(true));
		act(() => result.current.openDeleteFromActions());
		expect(result.current.isActionsOpen).toBe(false);
		expect(result.current.confirmingDelete).toBe(true);
	});

	it("handleEdit updates the room with the id and closes the sheet on success", async () => {
		const { result } = renderHook(() => useRoomDetailPage("s1"));
		act(() => result.current.setIsEditOpen(true));
		await act(async () => {
			result.current.handleEdit({ name: "Renamed", memo: "m" });
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(hoisted.update).toHaveBeenCalledWith({
			id: "s1",
			name: "Renamed",
			memo: "m",
		});
		await waitFor(() => expect(result.current.isEditOpen).toBe(false));
	});

	it("handleConfirmDelete deletes the room, closes the dialog, and navigates to /rooms", () => {
		const { result } = renderHook(() => useRoomDetailPage("s1"));
		act(() => result.current.setConfirmingDelete(true));
		act(() => result.current.handleConfirmDelete());
		expect(hoisted.del).toHaveBeenCalledWith("s1");
		expect(result.current.confirmingDelete).toBe(false);
		expect(hoisted.navigate).toHaveBeenCalledWith({ to: "/rooms" });
	});

	it("handleToggleFavorite closes the actions drawer and calls toggleFavorite with the room id", () => {
		const { result } = renderHook(() => useRoomDetailPage("s1"));
		act(() => result.current.setIsActionsOpen(true));
		act(() => result.current.handleToggleFavorite());
		expect(result.current.isActionsOpen).toBe(false);
		expect(hoisted.toggleFavorite).toHaveBeenCalledTimes(1);
		expect(hoisted.toggleFavorite).toHaveBeenCalledWith("s1");
	});

	it("handleToggleFavorite uses the correct roomId passed to the hook", () => {
		const { result } = renderHook(() => useRoomDetailPage("room-42"));
		act(() => result.current.handleToggleFavorite());
		expect(hoisted.toggleFavorite).toHaveBeenCalledWith("room-42");
	});
});
