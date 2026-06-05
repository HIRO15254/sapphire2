import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	stores: [] as Array<{
		id: string;
		memo?: string | null;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	}>,
	isCreatePending: false,
	isLoading: false,
}));

vi.mock("@/features/stores/hooks/use-stores", () => ({
	useStores: () => ({
		stores: mocks.stores,
		isLoading: mocks.isLoading,
		isCreatePending: mocks.isCreatePending,
		isUpdatePending: false,
		create: mocks.create,
		update: vi.fn(),
		delete: vi.fn(),
	}),
}));

import { useStoresPage } from "@/features/stores/pages/stores-page/use-stores-page";

describe("useStoresPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.stores = [];
		mocks.isCreatePending = false;
		mocks.isLoading = false;
	});

	describe("initial state", () => {
		it("has the create sheet closed by default", () => {
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.isCreateOpen).toBe(false);
		});

		it("exposes the stores list straight through including counts", () => {
			mocks.stores = [
				{
					id: "s1",
					name: "Akiba",
					memo: null,
					ringGameCount: 3,
					tournamentCount: 1,
				},
			];
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.stores).toEqual([
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
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.isCreatePending).toBe(true);
		});

		it("forwards isLoading=true from the data hook", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.isLoading).toBe(true);
		});

		it("forwards isLoading=false from the data hook", () => {
			mocks.isLoading = false;
			const { result } = renderHook(() => useStoresPage());
			expect(result.current.isLoading).toBe(false);
		});
	});

	describe("setIsCreateOpen", () => {
		it("opens the create sheet when called with true", () => {
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("closes the create sheet when called with false", () => {
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			act(() => {
				result.current.setIsCreateOpen(false);
			});
			expect(result.current.isCreateOpen).toBe(false);
		});
	});

	describe("handleCreate", () => {
		it("forwards values to create()", async () => {
			const { result } = renderHook(() => useStoresPage());
			await act(async () => {
				result.current.handleCreate({ name: "New Store", memo: "hello" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith({
				name: "New Store",
				memo: "hello",
			});
		});

		it("closes the sheet after create resolves", async () => {
			const { result } = renderHook(() => useStoresPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({ name: "New Store" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("keeps the sheet open when create rejects", async () => {
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
});
