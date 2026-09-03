import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	toggleFavorite: vi.fn(),
	rooms: [] as Array<{
		id: string;
		memo?: string | null;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	}>,
	isCreatePending: false,
	isLoading: false,
	isError: false,
	onRetry: vi.fn(),
	isInitialLoadError: false,
}));

vi.mock("@/features/rooms/hooks/use-rooms", () => ({
	useRooms: () => ({
		rooms: mocks.rooms,
		isLoading: mocks.isLoading,
		isError: mocks.isError,
		onRetry: mocks.onRetry,
		isInitialLoadError: mocks.isInitialLoadError,
		isCreatePending: mocks.isCreatePending,
		isUpdatePending: false,
		isToggleFavoritePending: false,
		create: mocks.create,
		update: vi.fn(),
		delete: vi.fn(),
		toggleFavorite: mocks.toggleFavorite,
	}),
}));

import { useRoomsPage } from "@/features/rooms/pages/rooms-page/use-rooms-page";

describe("useRoomsPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.toggleFavorite.mockReset().mockResolvedValue({ id: "s1" });
		mocks.rooms = [];
		mocks.isCreatePending = false;
		mocks.isLoading = false;
		mocks.isError = false;
		mocks.onRetry.mockReset();
		mocks.isInitialLoadError = false;
	});

	describe("initial state", () => {
		it("has the create sheet closed by default", () => {
			const { result } = renderHook(() => useRoomsPage());
			expect(result.current.isCreateOpen).toBe(false);
		});

		it("exposes the rooms list straight through including counts", () => {
			mocks.rooms = [
				{
					id: "s1",
					name: "Akiba",
					memo: null,
					ringGameCount: 3,
					tournamentCount: 1,
				},
			];
			const { result } = renderHook(() => useRoomsPage());
			expect(result.current.rooms).toEqual([
				{
					id: "s1",
					name: "Akiba",
					memo: null,
					ringGameCount: 3,
					tournamentCount: 1,
				},
			]);
		});

		it("forwards isCreatePending", () => {
			mocks.isCreatePending = true;
			const { result } = renderHook(() => useRoomsPage());
			expect(result.current.isCreatePending).toBe(true);
		});

		it.each([
			[true],
			[false],
		])("forwards isLoading=%s from the data hook", (isLoading) => {
			mocks.isLoading = isLoading;
			const { result } = renderHook(() => useRoomsPage());
			expect(result.current.isLoading).toBe(isLoading);
		});

		it("forwards an initial query error and retry callback", () => {
			mocks.isError = true;
			mocks.isInitialLoadError = true;
			const { result } = renderHook(() => useRoomsPage());
			expect(result.current.isError).toBe(true);
			expect(result.current.onRetry).toBe(mocks.onRetry);
		});
	});

	it("keeps cached rooms visible when a background refetch fails", () => {
		mocks.rooms = [
			{
				id: "s1",
				name: "Akiba",
				ringGameCount: 1,
				tournamentCount: 2,
			},
		];
		mocks.isError = true;
		mocks.isInitialLoadError = false;
		const { result } = renderHook(() => useRoomsPage());
		expect(result.current.isError).toBe(false);
		expect(result.current.rooms).toHaveLength(1);
	});
	describe("setIsCreateOpen", () => {
		it("toggles the create sheet open and closed", () => {
			const { result } = renderHook(() => useRoomsPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			expect(result.current.isCreateOpen).toBe(true);
			act(() => {
				result.current.setIsCreateOpen(false);
			});
			expect(result.current.isCreateOpen).toBe(false);
		});
	});

	describe("handleCreate", () => {
		it("forwards values to create()", async () => {
			const { result } = renderHook(() => useRoomsPage());
			await act(async () => {
				result.current.handleCreate({ name: "New Room", memo: "hello" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith({
				name: "New Room",
				memo: "hello",
			});
		});

		it("closes the sheet after create resolves", async () => {
			const { result } = renderHook(() => useRoomsPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({ name: "New Room" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("keeps the sheet open when create rejects", async () => {
			const unhandled = vi.fn();
			process.on("unhandledRejection", unhandled);
			mocks.create.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(() => useRoomsPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({ name: "Bad" });
				await new Promise((r) => setTimeout(r, 0));
			});
			expect(mocks.create).toHaveBeenCalledWith({ name: "Bad" });
			expect(result.current.isCreateOpen).toBe(true);
			process.off("unhandledRejection", unhandled);
		});
	});

	describe("handleToggleFavorite", () => {
		it.each([
			["s1"],
			["abc-123"],
		])("calls toggleFavorite with the given room id (%s)", (id) => {
			const { result } = renderHook(() => useRoomsPage());
			act(() => {
				result.current.handleToggleFavorite(id);
			});
			expect(mocks.toggleFavorite).toHaveBeenCalledWith(id);
		});
	});
});
