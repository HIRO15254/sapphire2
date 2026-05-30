import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	toggleFavorite: vi.fn(),
	lastExpandedId: null as string | null,
	currencies: [] as Array<{ id: string; name: string; unit?: string | null }>,
	isCreatePending: false,
}));

vi.mock("@/features/currencies/hooks/use-currencies", () => ({
	useCurrencies: (expandedId: string | null) => {
		mocks.lastExpandedId = expandedId;
		return {
			currencies: mocks.currencies,
			isLoading: false,
			allTransactions: [],
			txHasMore: false,
			isLoadingMore: false,
			isCreatePending: mocks.isCreatePending,
			isUpdatePending: false,
			isAddTransactionPending: false,
			isEditTransactionPending: false,
			isToggleFavoritePending: false,
			resetTransactionState: vi.fn(),
			create: mocks.create,
			update: vi.fn(),
			delete: vi.fn(),
			addTransaction: vi.fn(),
			editTransaction: vi.fn(),
			deleteTransaction: vi.fn(),
			toggleFavorite: mocks.toggleFavorite,
			handleLoadMore: vi.fn(),
		};
	},
}));

import { useCurrenciesPage } from "@/routes/currencies/-use-currencies-page";

describe("useCurrenciesPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.toggleFavorite.mockReset().mockResolvedValue(undefined);
		mocks.lastExpandedId = "sentinel";
		mocks.currencies = [];
		mocks.isCreatePending = false;
	});

	describe("initial state", () => {
		it("has the create dialog closed by default", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isCreateOpen).toBe(false);
		});

		it("passes null to useCurrencies (list page never expands a row)", () => {
			renderHook(() => useCurrenciesPage());
			expect(mocks.lastExpandedId).toBeNull();
		});

		it("exposes the currencies list straight through", () => {
			mocks.currencies = [{ id: "c1", name: "USD", unit: "$" }];
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.currencies).toEqual([
				{ id: "c1", name: "USD", unit: "$" },
			]);
		});

		it("forwards isCreatePending", () => {
			mocks.isCreatePending = true;
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isCreatePending).toBe(true);
		});
	});

	describe("setIsCreateOpen", () => {
		it("opens the create dialog when called with true", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("closes the create dialog when called with false", () => {
			const { result } = renderHook(() => useCurrenciesPage());
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
			const { result } = renderHook(() => useCurrenciesPage());
			await act(async () => {
				result.current.handleCreate({ name: "JPY", unit: "¥" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith({ name: "JPY", unit: "¥" });
		});

		it("closes the dialog after create resolves", async () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({ name: "JPY" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("forwards optional unit as undefined when not supplied", async () => {
			const { result } = renderHook(() => useCurrenciesPage());
			await act(async () => {
				result.current.handleCreate({ name: "JPY" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledWith({ name: "JPY" });
		});
	});

	describe("handleToggleFavorite", () => {
		it("delegates to toggleFavorite with the correct id", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleToggleFavorite("c42");
			});
			expect(mocks.toggleFavorite).toHaveBeenCalledTimes(1);
			expect(mocks.toggleFavorite).toHaveBeenCalledWith("c42");
		});
	});
});
