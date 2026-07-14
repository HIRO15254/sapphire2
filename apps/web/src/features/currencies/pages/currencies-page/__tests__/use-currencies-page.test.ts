import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	toggleFavorite: vi.fn(),
	lastExpandedId: null as string | null,
	currencies: [] as Array<{
		id: string;
		name: string;
		unit?: string | null;
		isFavorite: boolean;
	}>,
	isCreatePending: false,
	isLoading: false,
	isError: false,
	isInitialLoadError: false,
	retry: vi.fn(),
}));

vi.mock("@/features/currencies/hooks/use-currencies", () => ({
	useCurrencies: (expandedId: string | null) => {
		mocks.lastExpandedId = expandedId;
		return {
			currencies: mocks.currencies,
			isLoading: mocks.isLoading,
			allTransactions: [],
			hasNextPage: false,
			isFetchingNextPage: false,
			isCreatePending: mocks.isCreatePending,
			isError: mocks.isError,
			isInitialLoadError: mocks.isInitialLoadError,
			retry: mocks.retry,
			isUpdatePending: false,
			isAddTransactionPending: false,
			isEditTransactionPending: false,
			isToggleFavoritePending: false,
			create: mocks.create,
			update: vi.fn(),
			delete: vi.fn(),
			addTransaction: vi.fn(),
			editTransaction: vi.fn(),
			deleteTransaction: vi.fn(),
			toggleFavorite: mocks.toggleFavorite,
			fetchNextPage: vi.fn(),
		};
	},
}));

import { useCurrenciesPage } from "@/features/currencies/pages/currencies-page/use-currencies-page";

describe("useCurrenciesPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.toggleFavorite.mockReset().mockResolvedValue(undefined);
		mocks.lastExpandedId = "sentinel";
		mocks.currencies = [];
		mocks.isCreatePending = false;
		mocks.isError = false;
		mocks.isInitialLoadError = false;
		mocks.retry.mockReset();
		mocks.isLoading = false;
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

		it("exposes the currencies list straight through including isFavorite", () => {
			mocks.currencies = [
				{ id: "c1", name: "USD", unit: "$", isFavorite: true },
				{ id: "c2", name: "JPY", unit: null, isFavorite: false },
			];
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.currencies).toEqual([
				{ id: "c1", name: "USD", unit: "$", isFavorite: true },
				{ id: "c2", name: "JPY", unit: null, isFavorite: false },
			]);
		});

		it("forwards isCreatePending", () => {
			mocks.isCreatePending = true;
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isCreatePending).toBe(true);
		});

		it("forwards isLoading=true from the data hook", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isLoading).toBe(true);
		});

		it("forwards isLoading=false from the data hook", () => {
			mocks.isLoading = false;
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isLoading).toBe(false);
		});

		it("exposes an error when the initial currencies load fails", () => {
			mocks.isError = true;
			mocks.isInitialLoadError = true;
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isError).toBe(true);
			expect(result.current.retry).toBe(mocks.retry);
		});

		it("keeps cached currencies visible when a background refetch fails", () => {
			mocks.currencies = [
				{ id: "c1", name: "USD", unit: "$", isFavorite: true },
			];
			mocks.isError = true;
			mocks.isInitialLoadError = false;
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isError).toBe(false);
			expect(result.current.currencies).toHaveLength(1);
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
