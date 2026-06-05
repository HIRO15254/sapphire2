import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	usePlayers: vi.fn(),
	create: vi.fn(),
	createTag: vi.fn(),
	players: [] as Array<{ id: string; name: string }>,
	availableTags: [] as Array<{ color: string; id: string; name: string }>,
	isLoading: false,
	isCreatePending: false,
	lastFilterTagIds: [] as string[],
}));

vi.mock("@/features/players/hooks/use-players", () => ({
	usePlayers: (filterTagIds: string[]) => {
		mocks.usePlayers(filterTagIds);
		mocks.lastFilterTagIds = filterTagIds;
		return {
			players: mocks.players,
			availableTags: mocks.availableTags,
			isLoading: mocks.isLoading,
			isCreatePending: mocks.isCreatePending,
			isUpdatePending: false,
			create: mocks.create,
			update: vi.fn(),
			delete: vi.fn(),
			createTag: mocks.createTag,
		};
	},
}));

import { usePlayersPage } from "@/features/players/pages/players-page/use-players-page";

describe("usePlayersPage", () => {
	beforeEach(() => {
		mocks.usePlayers.mockReset();
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.createTag.mockReset().mockResolvedValue({
			id: "t",
			name: "T",
			color: "gray",
		});
		mocks.players = [];
		mocks.availableTags = [];
		mocks.isLoading = false;
		mocks.isCreatePending = false;
		mocks.lastFilterTagIds = [];
	});

	describe("initial state", () => {
		it("has the create sheet closed and no active filter", () => {
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.filterTagIds).toEqual([]);
		});

		it("forwards players and availableTags straight through", () => {
			mocks.players = [{ id: "p1", name: "Alice" }];
			mocks.availableTags = [{ id: "vip", name: "VIP", color: "blue" }];
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.players).toEqual([{ id: "p1", name: "Alice" }]);
			expect(result.current.availableTags).toEqual([
				{ id: "vip", name: "VIP", color: "blue" },
			]);
		});

		it("forwards isLoading and isCreatePending", () => {
			mocks.isLoading = true;
			mocks.isCreatePending = true;
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.isLoading).toBe(true);
			expect(result.current.isCreatePending).toBe(true);
		});

		it("passes the empty filter to usePlayers initially", () => {
			renderHook(() => usePlayersPage());
			expect(mocks.usePlayers).toHaveBeenLastCalledWith([]);
		});
	});

	describe("setIsCreateOpen", () => {
		it("opens the create sheet", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("closes the create sheet", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			act(() => result.current.setIsCreateOpen(false));
			expect(result.current.isCreateOpen).toBe(false);
		});
	});

	describe("toggleFilterTag", () => {
		it("adds a tag id that is not selected", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.toggleFilterTag("vip"));
			expect(result.current.filterTagIds).toEqual(["vip"]);
		});

		it("removes a tag id that is already selected", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.toggleFilterTag("vip"));
			act(() => result.current.toggleFilterTag("vip"));
			expect(result.current.filterTagIds).toEqual([]);
		});

		it("accumulates multiple distinct tag ids", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.toggleFilterTag("vip"));
			act(() => result.current.toggleFilterTag("reg"));
			expect(result.current.filterTagIds).toEqual(["vip", "reg"]);
		});

		it("re-runs usePlayers with the updated filter", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.toggleFilterTag("vip"));
			expect(mocks.usePlayers).toHaveBeenLastCalledWith(["vip"]);
		});
	});

	describe("handleCreate", () => {
		it("forwards values to create()", async () => {
			const { result } = renderHook(() => usePlayersPage());
			await act(async () => {
				result.current.handleCreate({ name: "Bob", memo: null });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith({ name: "Bob", memo: null });
		});

		it("closes the sheet after create resolves", async () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			await act(async () => {
				result.current.handleCreate({ name: "Bob" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("keeps the sheet open when create rejects", async () => {
			const unhandled = vi.fn();
			process.on("unhandledRejection", unhandled);
			mocks.create.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(() => usePlayersPage());
			act(() => result.current.setIsCreateOpen(true));
			await act(async () => {
				result.current.handleCreate({ name: "Bad" });
				await new Promise((r) => setTimeout(r, 0));
			});
			expect(result.current.isCreateOpen).toBe(true);
			process.off("unhandledRejection", unhandled);
		});
	});

	describe("createTag", () => {
		it("passes through to the data hook's createTag", async () => {
			const { result } = renderHook(() => usePlayersPage());
			await act(async () => {
				await result.current.createTag("New");
			});
			expect(mocks.createTag).toHaveBeenCalledWith("New");
		});
	});
});
