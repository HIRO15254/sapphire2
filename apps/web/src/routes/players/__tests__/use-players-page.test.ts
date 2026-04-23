import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
	createTag: vi.fn(),
	players: [] as Array<{
		createdAt: string;
		id: string;
		isTemporary: boolean;
		memo: string | null;
		name: string;
		tags: Array<{ id: string; name: string; color: string }>;
		updatedAt: string;
		userId: string;
	}>,
	availableTags: [] as Array<{ id: string; name: string; color: string }>,
	isCreatePending: false,
	isUpdatePending: false,
	lastFilterTagIds: null as string[] | null,
}));

vi.mock("@/features/players/hooks/use-players", () => ({
	usePlayers: (filterTagIds: string[]) => {
		mocks.lastFilterTagIds = filterTagIds;
		return {
			players: mocks.players,
			availableTags: mocks.availableTags,
			isCreatePending: mocks.isCreatePending,
			isUpdatePending: mocks.isUpdatePending,
			create: mocks.create,
			update: mocks.update,
			delete: mocks.del,
			createTag: mocks.createTag,
		};
	},
}));

import { usePlayersPage } from "@/routes/players/-use-players-page";

function buildPlayer(
	overrides: Partial<(typeof mocks.players)[number]> = {}
): (typeof mocks.players)[number] {
	return {
		id: "p1",
		name: "Alice",
		memo: null,
		tags: [],
		isTemporary: false,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		userId: "u1",
		...overrides,
	};
}

describe("usePlayersPage", () => {
	beforeEach(() => {
		mocks.create.mockReset();
		mocks.update.mockReset();
		mocks.del.mockReset();
		mocks.createTag.mockReset();
		mocks.players = [];
		mocks.availableTags = [];
		mocks.isCreatePending = false;
		mocks.isUpdatePending = false;
		mocks.lastFilterTagIds = null;
	});

	describe("initial state", () => {
		it("defaults all UI flags to closed and has empty filter tags", () => {
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.editingPlayer).toBeNull();
			expect(result.current.isTagManagerOpen).toBe(false);
			expect(result.current.filterTagIds).toEqual([]);
		});

		it("passes empty filterTagIds into usePlayers initially", () => {
			renderHook(() => usePlayersPage());
			expect(mocks.lastFilterTagIds).toEqual([]);
		});

		it("exposes players and availableTags from the inner hook", () => {
			mocks.players = [buildPlayer({ id: "p1", name: "Alice" })];
			mocks.availableTags = [{ id: "t1", name: "VIP", color: "blue" }];
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.players).toEqual(mocks.players);
			expect(result.current.availableTags).toEqual(mocks.availableTags);
		});
	});

	describe("setFilterTagIds", () => {
		it("propagates the new filter into usePlayers on next render", () => {
			const { result, rerender } = renderHook(() => usePlayersPage());
			act(() => {
				result.current.setFilterTagIds(["tag-a", "tag-b"]);
			});
			rerender();
			expect(mocks.lastFilterTagIds).toEqual(["tag-a", "tag-b"]);
			expect(result.current.filterTagIds).toEqual(["tag-a", "tag-b"]);
		});
	});

	describe("handleCreate", () => {
		it("forwards values to create and closes the dialog on success", async () => {
			mocks.create.mockResolvedValue({ id: "new" });
			const { result } = renderHook(() => usePlayersPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({ name: "Bob", memo: null, tagIds: [] });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledWith({
				name: "Bob",
				memo: null,
				tagIds: [],
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});
	});

	describe("handleUpdate", () => {
		it("is a no-op when editingPlayer is null", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => {
				result.current.handleUpdate({ name: "x", memo: null, tagIds: [] });
			});
			expect(mocks.update).not.toHaveBeenCalled();
		});

		it("merges id and clears editingPlayer on success", async () => {
			mocks.update.mockResolvedValue({ id: "p1" });
			const { result } = renderHook(() => usePlayersPage());
			act(() => {
				result.current.handleOpenEdit(buildPlayer({ id: "p1", name: "Old" }));
			});
			await act(async () => {
				result.current.handleUpdate({
					name: "Renamed",
					memo: "note",
					tagIds: ["t1"],
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "p1",
				name: "Renamed",
				memo: "note",
				tagIds: ["t1"],
			});
			await waitFor(() => expect(result.current.editingPlayer).toBeNull());
		});
	});

	describe("handleDelete", () => {
		it("forwards the id through to delete", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => {
				result.current.handleDelete("p1");
			});
			expect(mocks.del).toHaveBeenCalledWith("p1");
		});
	});

	describe("handleOpenEdit / handleCloseEdit", () => {
		it("handleOpenEdit sets editingPlayer with isTemporary forced to false", () => {
			const { result } = renderHook(() => usePlayersPage());
			const temp = buildPlayer({ id: "t1", name: "Temp", isTemporary: true });
			act(() => {
				result.current.handleOpenEdit(temp);
			});
			expect(result.current.editingPlayer).toEqual({
				...temp,
				isTemporary: false,
			});
		});

		it("handleCloseEdit clears editingPlayer", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => {
				result.current.handleOpenEdit(buildPlayer());
			});
			expect(result.current.editingPlayer).not.toBeNull();
			act(() => {
				result.current.handleCloseEdit();
			});
			expect(result.current.editingPlayer).toBeNull();
		});
	});

	describe("tag manager", () => {
		it("opens and closes via setIsTagManagerOpen", () => {
			const { result } = renderHook(() => usePlayersPage());
			act(() => {
				result.current.setIsTagManagerOpen(true);
			});
			expect(result.current.isTagManagerOpen).toBe(true);
			act(() => {
				result.current.setIsTagManagerOpen(false);
			});
			expect(result.current.isTagManagerOpen).toBe(false);
		});
	});

	describe("createTag passthrough", () => {
		it("exposes the inner createTag function directly", () => {
			const { result } = renderHook(() => usePlayersPage());
			expect(result.current.createTag).toBe(mocks.createTag);
		});
	});
});
