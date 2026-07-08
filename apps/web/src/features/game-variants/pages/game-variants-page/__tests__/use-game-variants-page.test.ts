import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameVariantRow } from "../types";

const mocks = vi.hoisted(() => ({
	onCreate: vi.fn(),
	onUpdate: vi.fn(),
	onArchive: vi.fn(),
	onRestore: vi.fn(),
	onDelete: vi.fn(),
	variants: [] as GameVariantRow[],
	isPending: false,
	isCreatePending: false,
	isUpdatePending: false,
	isArchivePending: false,
	isRestorePending: false,
	isDeletePending: false,
	useGameVariantsArgs: [] as unknown[],
}));

vi.mock("@/features/game-variants/hooks/use-game-variants", () => ({
	useGameVariants: (...args: unknown[]) => {
		mocks.useGameVariantsArgs.push(args[0]);
		return {
			variants: mocks.variants,
			isPending: mocks.isPending,
			isCreatePending: mocks.isCreatePending,
			isUpdatePending: mocks.isUpdatePending,
			isArchivePending: mocks.isArchivePending,
			isRestorePending: mocks.isRestorePending,
			isDeletePending: mocks.isDeletePending,
			onCreate: mocks.onCreate,
			onUpdate: mocks.onUpdate,
			onArchive: mocks.onArchive,
			onRestore: mocks.onRestore,
			onDelete: mocks.onDelete,
		};
	},
}));

import { useGameVariantsPage } from "@/features/game-variants/pages/game-variants-page/use-game-variants-page";

function variant(overrides: Partial<GameVariantRow> = {}): GameVariantRow {
	return {
		archivedAt: null,
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
		id: "v1",
		name: "NLH",
		sortOrder: 0,
		...overrides,
	};
}

describe("useGameVariantsPage", () => {
	beforeEach(() => {
		mocks.onCreate.mockReset().mockResolvedValue({ id: "new" });
		mocks.onUpdate.mockReset().mockResolvedValue({ id: "v1" });
		mocks.onArchive.mockReset().mockResolvedValue({ id: "v1" });
		mocks.onRestore.mockReset().mockResolvedValue({ id: "v1" });
		mocks.onDelete.mockReset().mockResolvedValue({ success: true });
		mocks.variants = [];
		mocks.isPending = false;
		mocks.isCreatePending = false;
		mocks.isUpdatePending = false;
		mocks.isArchivePending = false;
		mocks.isRestorePending = false;
		mocks.isDeletePending = false;
		mocks.useGameVariantsArgs = [];
	});

	describe("initial state", () => {
		it("starts with all sheets/dialogs closed and archived hidden", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.editingVariant).toBeNull();
			expect(result.current.pendingDelete).toBeNull();
			expect(result.current.showArchived).toBe(false);
		});

		it("calls useGameVariants with includeArchived: true", () => {
			renderHook(() => useGameVariantsPage());
			expect(mocks.useGameVariantsArgs).toEqual([{ includeArchived: true }]);
		});

		it("forwards isLoading from the data hook's isPending", () => {
			mocks.isPending = true;
			const { result } = renderHook(() => useGameVariantsPage());
			expect(result.current.isLoading).toBe(true);
		});

		it("forwards the pending flags for each mutation", () => {
			mocks.isCreatePending = true;
			mocks.isUpdatePending = true;
			mocks.isArchivePending = true;
			mocks.isRestorePending = true;
			mocks.isDeletePending = true;
			const { result } = renderHook(() => useGameVariantsPage());
			expect(result.current.isCreatePending).toBe(true);
			expect(result.current.isUpdatePending).toBe(true);
			expect(result.current.isArchivePending).toBe(true);
			expect(result.current.isRestorePending).toBe(true);
			expect(result.current.isDeletePending).toBe(true);
		});
	});

	describe("activeVariants / archivedVariants split", () => {
		it("puts variants with a null archivedAt into activeVariants", () => {
			mocks.variants = [variant({ id: "v1", archivedAt: null })];
			const { result } = renderHook(() => useGameVariantsPage());
			expect(result.current.activeVariants).toEqual(mocks.variants);
			expect(result.current.archivedVariants).toEqual([]);
		});

		it("puts variants with a non-null archivedAt into archivedVariants", () => {
			mocks.variants = [
				variant({ id: "v1", archivedAt: "2026-01-01T00:00:00.000Z" }),
			];
			const { result } = renderHook(() => useGameVariantsPage());
			expect(result.current.activeVariants).toEqual([]);
			expect(result.current.archivedVariants).toEqual(mocks.variants);
		});

		it("splits a mixed list into both groups", () => {
			const active = variant({ id: "v1", archivedAt: null });
			const archived = variant({
				id: "v2",
				archivedAt: "2026-01-01T00:00:00.000Z",
			});
			mocks.variants = [active, archived];
			const { result } = renderHook(() => useGameVariantsPage());
			expect(result.current.activeVariants).toEqual([active]);
			expect(result.current.archivedVariants).toEqual([archived]);
		});
	});

	describe("toggleArchived", () => {
		it("flips showArchived from false to true", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.toggleArchived());
			expect(result.current.showArchived).toBe(true);
		});

		it("flips showArchived back to false on a second call", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.toggleArchived());
			act(() => result.current.toggleArchived());
			expect(result.current.showArchived).toBe(false);
		});
	});

	describe("setIsCreateOpen", () => {
		it("opens the create sheet when called with true", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.setIsCreateOpen(true));
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("closes the create sheet when called with false", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.setIsCreateOpen(true));
			act(() => result.current.setIsCreateOpen(false));
			expect(result.current.isCreateOpen).toBe(false);
		});
	});

	describe("handleCreate", () => {
		it("forwards values to onCreate", async () => {
			const { result } = renderHook(() => useGameVariantsPage());
			await act(async () => {
				result.current.handleCreate({ name: "PLO5" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.onCreate).toHaveBeenCalledTimes(1);
			expect(mocks.onCreate).toHaveBeenNthCalledWith(1, { name: "PLO5" });
		});

		it("closes the create sheet after onCreate resolves", async () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.setIsCreateOpen(true));
			await act(async () => {
				result.current.handleCreate({ name: "PLO5" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("keeps the sheet open when onCreate rejects", async () => {
			const unhandled = vi.fn();
			process.on("unhandledRejection", unhandled);
			mocks.onCreate.mockRejectedValue(new Error("conflict"));
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.setIsCreateOpen(true));
			await act(async () => {
				result.current.handleCreate({ name: "Dup" });
				await new Promise((r) => setTimeout(r, 0));
			});
			expect(result.current.isCreateOpen).toBe(true);
			process.off("unhandledRejection", unhandled);
		});
	});

	describe("editingVariant / handleUpdate", () => {
		it("setEditingVariant stores the target variant", () => {
			const target = variant({ id: "v1" });
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.setEditingVariant(target));
			expect(result.current.editingVariant).toEqual(target);
		});

		it("handleUpdate is a no-op when there is no editingVariant", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.handleUpdate({ name: "Renamed" }));
			expect(mocks.onUpdate).not.toHaveBeenCalled();
		});

		it("handleUpdate calls onUpdate with the editingVariant id merged in", async () => {
			const target = variant({ id: "v1" });
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.setEditingVariant(target));
			await act(async () => {
				result.current.handleUpdate({
					name: "Renamed",
					blindLabel1: "SB",
					blindLabel2: "BB",
					blindLabel3: null,
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.onUpdate).toHaveBeenCalledTimes(1);
			expect(mocks.onUpdate).toHaveBeenNthCalledWith(1, {
				id: "v1",
				name: "Renamed",
				blindLabel1: "SB",
				blindLabel2: "BB",
				blindLabel3: null,
			});
		});

		it("closes the edit sheet after onUpdate resolves", async () => {
			const target = variant({ id: "v1" });
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.setEditingVariant(target));
			await act(async () => {
				result.current.handleUpdate({ name: "Renamed" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.editingVariant).toBeNull());
		});
	});

	describe("handleArchive / handleRestore", () => {
		it("calls onArchive with the given id", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.handleArchive("v1"));
			expect(mocks.onArchive).toHaveBeenCalledTimes(1);
			expect(mocks.onArchive).toHaveBeenNthCalledWith(1, "v1");
		});

		it("calls onRestore with the given id", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.handleRestore("v1"));
			expect(mocks.onRestore).toHaveBeenCalledTimes(1);
			expect(mocks.onRestore).toHaveBeenNthCalledWith(1, "v1");
		});
	});

	describe("delete flow", () => {
		it("openDelete stores the target variant as pendingDelete", () => {
			const target = variant({ id: "v1" });
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.openDelete(target));
			expect(result.current.pendingDelete).toEqual(target);
		});

		it("cancelDelete clears pendingDelete", () => {
			const target = variant({ id: "v1" });
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.openDelete(target));
			act(() => result.current.cancelDelete());
			expect(result.current.pendingDelete).toBeNull();
		});

		it("handleConfirmDelete is a no-op when there is no pendingDelete", () => {
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.handleConfirmDelete());
			expect(mocks.onDelete).not.toHaveBeenCalled();
		});

		it("handleConfirmDelete calls onDelete with the pending id and clears pendingDelete", () => {
			const target = variant({ id: "v1" });
			const { result } = renderHook(() => useGameVariantsPage());
			act(() => result.current.openDelete(target));
			act(() => result.current.handleConfirmDelete());
			expect(mocks.onDelete).toHaveBeenCalledTimes(1);
			expect(mocks.onDelete).toHaveBeenNthCalledWith(1, "v1");
			expect(result.current.pendingDelete).toBeNull();
		});
	});
});
