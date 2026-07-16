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

vi.mock("@/features/rooms/hooks/use-ring-games", () => ({
	useRingGames: hoisted.useRingGames,
}));

import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { useRingGameTab } from "@/features/rooms/pages/room-detail-page/ring-game-tab/use-ring-game-tab";

function gamesStub(activeGames: RingGame[]) {
	return {
		activeGames,
		archivedGames: [],
		currencies: [],
		activeLoading: false,
		isInitialLoadError: false,
		onRetry: vi.fn(),
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

const game = (id: string, name = "1/2") => ({ id, name }) as RingGame;

describe("useRingGameTab", () => {
	beforeEach(() => {
		for (const m of [
			hoisted.create,
			hoisted.update,
			hoisted.archive,
			hoisted.restore,
			hoisted.del,
		]) {
			m.mockReset();
		}
		hoisted.useRingGames.mockReturnValue(gamesStub([]));
	});

	it("starts with showArchived=false, sheet closed, no targets", () => {
		const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
		expect(result.current.showArchived).toBe(false);
		expect(result.current.isCreateOpen).toBe(false);
		expect(result.current.editingGame).toBeNull();
		expect(result.current.actionsTarget).toBeNull();
		expect(result.current.pendingDelete).toBeNull();
	});

	it("toggleArchived flips showArchived back and forth", () => {
		const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
		act(() => result.current.toggleArchived());
		expect(result.current.showArchived).toBe(true);
		act(() => result.current.toggleArchived());
		expect(result.current.showArchived).toBe(false);
	});

	it("handleCreate calls create and closes the create sheet on success", async () => {
		hoisted.create.mockResolvedValue({ id: "g-new" });
		const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
		act(() => result.current.setIsCreateOpen(true));
		act(() => {
			result.current.handleCreate({ name: "n", variant: "nlh" });
		});
		await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		expect(hoisted.create).toHaveBeenCalledWith({ name: "n", variant: "nlh" });
	});

	it("handleUpdate is a no-op when no editingGame is set", () => {
		const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
		act(() => {
			result.current.handleUpdate({ name: "n", variant: "nlh" });
		});
		expect(hoisted.update).not.toHaveBeenCalled();
	});

	it("handleUpdate calls update with the id and clears editingGame on success", async () => {
		hoisted.update.mockResolvedValue({ id: "g1" });
		const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
		act(() => result.current.setEditingGame(game("g1", "old")));
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

	describe("action drawer", () => {
		it("openActions sets the target; closeActions clears it", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			const g = game("g1");
			act(() => result.current.openActions(g));
			expect(result.current.actionsTarget).toBe(g);
			act(() => result.current.closeActions());
			expect(result.current.actionsTarget).toBeNull();
		});

		it("openEditFromActions moves the target into editingGame and closes the drawer", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			const g = game("g1");
			act(() => result.current.openActions(g));
			act(() => result.current.openEditFromActions());
			expect(result.current.editingGame).toBe(g);
			expect(result.current.actionsTarget).toBeNull();
		});

		it("openDeleteFromActions moves the target into pendingDelete and closes the drawer", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			const g = game("g1");
			act(() => result.current.openActions(g));
			act(() => result.current.openDeleteFromActions());
			expect(result.current.pendingDelete).toBe(g);
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleArchiveFromActions archives the target id and closes the drawer", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.openActions(game("g1")));
			act(() => result.current.handleArchiveFromActions());
			expect(hoisted.archive).toHaveBeenCalledTimes(1);
			expect(hoisted.archive).toHaveBeenCalledWith("g1");
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleRestoreFromActions restores the target id and closes the drawer", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.openActions(game("g1")));
			act(() => result.current.handleRestoreFromActions());
			expect(hoisted.restore).toHaveBeenCalledTimes(1);
			expect(hoisted.restore).toHaveBeenCalledWith("g1");
			expect(result.current.actionsTarget).toBeNull();
		});

		it("openEditFromActions is a no-op when no target is set", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.openEditFromActions());
			expect(result.current.editingGame).toBeNull();
			expect(result.current.actionsTarget).toBeNull();
		});

		it("openDeleteFromActions is a no-op when no target is set", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.openDeleteFromActions());
			expect(result.current.pendingDelete).toBeNull();
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleArchiveFromActions is a no-op when no target is set", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.handleArchiveFromActions());
			expect(hoisted.archive).not.toHaveBeenCalled();
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleRestoreFromActions is a no-op when no target is set", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.handleRestoreFromActions());
			expect(hoisted.restore).not.toHaveBeenCalled();
			expect(result.current.actionsTarget).toBeNull();
		});
	});

	describe("delete confirmation", () => {
		it("handleConfirmDelete deletes the pending id and clears it", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.openActions(game("g1")));
			act(() => result.current.openDeleteFromActions());
			act(() => result.current.handleConfirmDelete());
			expect(hoisted.del).toHaveBeenCalledTimes(1);
			expect(hoisted.del).toHaveBeenCalledWith("g1");
			expect(result.current.pendingDelete).toBeNull();
		});

		it("handleConfirmDelete is a no-op when nothing is pending", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.handleConfirmDelete());
			expect(hoisted.del).not.toHaveBeenCalled();
		});

		it("cancelDelete clears the pending target without deleting", () => {
			const { result } = renderHook(() => useRingGameTab({ roomId: "s1" }));
			act(() => result.current.openActions(game("g1")));
			act(() => result.current.openDeleteFromActions());
			act(() => result.current.cancelDelete());
			expect(result.current.pendingDelete).toBeNull();
			expect(hoisted.del).not.toHaveBeenCalled();
		});
	});
});
