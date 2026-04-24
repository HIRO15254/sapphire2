import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
	stores: [] as Array<{ id: string; memo?: string | null; name: string }>,
	isCreatePending: false,
	isUpdatePending: false,
}));

vi.mock("@/features/stores/hooks/use-stores", () => ({
	useStores: () => ({
		stores: mocks.stores,
		isCreatePending: mocks.isCreatePending,
		isUpdatePending: mocks.isUpdatePending,
		create: mocks.create,
		update: mocks.update,
		delete: mocks.del,
	}),
}));

import { useStoresPage } from "@/routes/stores/-use-stores-page";

describe("useStoresPage", () => {
	beforeEach(() => {
		mocks.create.mockReset();
		mocks.update.mockReset();
		mocks.del.mockReset();
		mocks.stores = [];
		mocks.isCreatePending = false;
		mocks.isUpdatePending = false;
	});

	describe("initial state", () => {
		it("is closed and has no editing target by default", () => {
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.editingStore).toBeNull();
		});

		it("surfaces the inner hook's stores list", () => {
			mocks.stores = [
				{ id: "s1", name: "Akiba", memo: null },
				{ id: "s2", name: "Shinjuku", memo: "late" },
			];
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.stores).toEqual(mocks.stores);
		});

		it("reflects pending flags from useStores", () => {
			mocks.isCreatePending = true;
			mocks.isUpdatePending = true;
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.isCreatePending).toBe(true);
			expect(result.current.isUpdatePending).toBe(true);
		});
	});

	describe("setIsCreateOpen", () => {
		it("toggles the create dialog open flag", () => {
			const { result } = renderHook(() => useStoresPage());
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

	describe("setEditingStore", () => {
		it("sets and clears the editing target", () => {
			const { result } = renderHook(() => useStoresPage());
			const store = { id: "s1", name: "Akiba", memo: null };
			act(() => {
				result.current.setEditingStore(store);
			});
			expect(result.current.editingStore).toEqual(store);
			act(() => {
				result.current.setEditingStore(null);
			});
			expect(result.current.editingStore).toBeNull();
		});
	});

	describe("handleCreate", () => {
		it("forwards values to create and closes the dialog on success", async () => {
			mocks.create.mockResolvedValue({ id: "s-new" });
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({ name: "New Store", memo: "hello" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledWith({
				name: "New Store",
				memo: "hello",
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("keeps isCreateOpen open when create rejects", async () => {
			// The hook chains .then() without .catch(), so a rejected create leaves
			// the rejection unhandled. Intercept unhandledRejection for this test.
			const unhandled = vi.fn();
			process.on("unhandledRejection", unhandled);
			mocks.create.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(() => useStoresPage());
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

	describe("handleUpdate", () => {
		it("is a no-op when no editing target is set", () => {
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.handleUpdate({ name: "x" });
			});
			expect(mocks.update).not.toHaveBeenCalled();
		});

		it("merges id with values and clears editingStore on success", async () => {
			mocks.update.mockResolvedValue({ id: "s1" });
			const store = { id: "s1", name: "Old", memo: null };
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.setEditingStore(store);
			});
			await act(async () => {
				result.current.handleUpdate({ name: "New", memo: "fresh" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "s1",
				name: "New",
				memo: "fresh",
			});
			await waitFor(() => expect(result.current.editingStore).toBeNull());
		});
	});

	describe("handleDelete", () => {
		it("forwards the id to delete", () => {
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.handleDelete("s1");
			});
			expect(mocks.del).toHaveBeenCalledWith("s1");
		});
	});

	describe("handleCloseEdit", () => {
		it("clears editingStore to null", () => {
			const store = { id: "s1", name: "Akiba", memo: null };
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.setEditingStore(store);
			});
			expect(result.current.editingStore).toEqual(store);
			act(() => {
				result.current.handleCloseEdit();
			});
			expect(result.current.editingStore).toBeNull();
		});
	});
});
