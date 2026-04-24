import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
	useRingGames: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	archive: vi.fn(),
	restore: vi.fn(),
	del: vi.fn(),
}));

vi.mock("@/features/stores/hooks/use-ring-games", () => ({
	useRingGames: hoisted.useRingGames,
}));

import { useRingGameTab } from "@/features/stores/components/ring-game-tab/use-ring-game-tab";
import type { RingGame } from "@/features/stores/hooks/use-ring-games";

function gamesStub(activeGames: RingGame[]) {
	return {
		activeGames,
		archivedGames: [],
		currencies: [],
		activeLoading: false,
		archivedLoading: false,
		isCreatePending: false,
		isUpdatePending: false,
		create: hoisted.create,
		update: hoisted.update,
		archive: hoisted.archive,
		restore: hoisted.restore,
		delete: hoisted.del,
	};
}

describe("useRingGameTab", () => {
	beforeEach(() => {
		hoisted.create.mockReset();
		hoisted.update.mockReset();
		hoisted.useRingGames.mockReturnValue(gamesStub([]));
	});

	it("starts with showArchived=false, dialogs closed, editingGame=null", () => {
		const { result } = renderHook(() => useRingGameTab({ storeId: "s1" }));
		expect(result.current.showArchived).toBe(false);
		expect(result.current.isCreateOpen).toBe(false);
		expect(result.current.editingGame).toBeNull();
	});

	it("setShowArchived / setIsCreateOpen / setEditingGame transitions", () => {
		const { result } = renderHook(() => useRingGameTab({ storeId: "s1" }));
		act(() => {
			result.current.setShowArchived(true);
			result.current.setIsCreateOpen(true);
		});
		expect(result.current.showArchived).toBe(true);
		expect(result.current.isCreateOpen).toBe(true);
		const game = { id: "g1", name: "1/2" } as RingGame;
		act(() => {
			result.current.setEditingGame(game);
		});
		expect(result.current.editingGame).toBe(game);
	});

	it("handleCreate calls create and closes the create dialog on success", async () => {
		hoisted.create.mockResolvedValue({ id: "g-new" });
		const { result } = renderHook(() => useRingGameTab({ storeId: "s1" }));
		act(() => {
			result.current.setIsCreateOpen(true);
		});
		act(() => {
			result.current.handleCreate({ name: "n", variant: "nlh" });
		});
		await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		expect(hoisted.create).toHaveBeenCalledWith({ name: "n", variant: "nlh" });
	});

	it("handleUpdate is a no-op when no editingGame is set", () => {
		const { result } = renderHook(() => useRingGameTab({ storeId: "s1" }));
		act(() => {
			result.current.handleUpdate({ name: "n", variant: "nlh" });
		});
		expect(hoisted.update).not.toHaveBeenCalled();
	});

	it("handleUpdate calls update with the id and clears editingGame on success", async () => {
		hoisted.update.mockResolvedValue({ id: "g1" });
		const { result } = renderHook(() => useRingGameTab({ storeId: "s1" }));
		const editing = { id: "g1", name: "old" } as RingGame;
		act(() => {
			result.current.setEditingGame(editing);
		});
		act(() => {
			result.current.handleUpdate({ name: "new", variant: "nlh" });
		});
		await waitFor(() => expect(result.current.editingGame).toBeNull());
		expect(hoisted.update).toHaveBeenCalledWith({
			id: "g1",
			name: "new",
			variant: "nlh",
		});
	});
});
