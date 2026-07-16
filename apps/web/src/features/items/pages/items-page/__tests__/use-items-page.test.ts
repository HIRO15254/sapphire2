import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	lastExpandedId: null as string | null,
	items: [] as Array<{
		currencyName?: string | null;
		currencyUnit?: string | null;
		holdings: number;
		id: string;
		name: string;
		unitValue: number;
	}>,
	isCreatePending: false,
	isLoading: false,
	isError: false,
	isInitialLoadError: false,
	retry: vi.fn(),
}));

vi.mock("@/features/items/hooks/use-items", () => ({
	useItems: (expandedId: string | null) => {
		mocks.lastExpandedId = expandedId;
		return {
			items: mocks.items,
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
			create: mocks.create,
			update: vi.fn(),
			delete: vi.fn(),
			addTransaction: vi.fn(),
			editTransaction: vi.fn(),
			deleteTransaction: vi.fn(),
			fetchNextPage: vi.fn(),
		};
	},
}));

import { useItemsPage } from "@/features/items/pages/items-page/use-items-page";

describe("useItemsPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.lastExpandedId = "sentinel";
		mocks.items = [];
		mocks.isCreatePending = false;
		mocks.isError = false;
		mocks.isInitialLoadError = false;
		mocks.retry.mockReset();
		mocks.isLoading = false;
	});

	describe("initial state", () => {
		it("has the create dialog closed by default", () => {
			const { result } = renderHook(() => useItemsPage());
			expect(result.current.isCreateOpen).toBe(false);
		});

		it("passes null to useItems (list page never expands a row)", () => {
			renderHook(() => useItemsPage());
			expect(mocks.lastExpandedId).toBeNull();
		});

		it("exposes the items list straight through", () => {
			mocks.items = [
				{
					id: "i1",
					name: "Ticket",
					currencyName: "USD",
					currencyUnit: "$",
					unitValue: 100,
					holdings: 3,
				},
				{
					id: "i2",
					name: "Voucher",
					currencyName: null,
					currencyUnit: null,
					unitValue: 0,
					holdings: 0,
				},
			];
			const { result } = renderHook(() => useItemsPage());
			expect(result.current.items).toEqual(mocks.items);
		});

		it("forwards isCreatePending", () => {
			mocks.isCreatePending = true;
			const { result } = renderHook(() => useItemsPage());
			expect(result.current.isCreatePending).toBe(true);
		});

		it("forwards isLoading=true from the data hook", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useItemsPage());
			expect(result.current.isLoading).toBe(true);
		});

		it("forwards isLoading=false from the data hook", () => {
			mocks.isLoading = false;
			const { result } = renderHook(() => useItemsPage());
			expect(result.current.isLoading).toBe(false);
		});

		it("exposes an error when the initial items load fails", () => {
			mocks.isError = true;
			mocks.isInitialLoadError = true;
			const { result } = renderHook(() => useItemsPage());
			expect(result.current.isError).toBe(true);
			expect(result.current.retry).toBe(mocks.retry);
		});

		it("keeps cached items visible when a background refetch fails", () => {
			mocks.items = [
				{
					id: "i1",
					name: "Ticket",
					currencyName: "USD",
					currencyUnit: "$",
					unitValue: 100,
					holdings: 3,
				},
			];
			mocks.isError = true;
			mocks.isInitialLoadError = false;
			const { result } = renderHook(() => useItemsPage());
			expect(result.current.isError).toBe(false);
			expect(result.current.items).toHaveLength(1);
		});
	});

	describe("setIsCreateOpen", () => {
		it("opens the create dialog when called with true", () => {
			const { result } = renderHook(() => useItemsPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			expect(result.current.isCreateOpen).toBe(true);
		});

		it("closes the create dialog when called with false", () => {
			const { result } = renderHook(() => useItemsPage());
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
			const { result } = renderHook(() => useItemsPage());
			await act(async () => {
				result.current.handleCreate({
					name: "Ticket",
					currencyId: "c1",
					unitValue: 100,
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledTimes(1);
			expect(mocks.create).toHaveBeenCalledWith({
				name: "Ticket",
				currencyId: "c1",
				unitValue: 100,
			});
		});

		it("closes the dialog after create resolves", async () => {
			const { result } = renderHook(() => useItemsPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({
					name: "Ticket",
					currencyId: "c1",
					unitValue: 100,
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});

		it("forwards the description when supplied", async () => {
			const { result } = renderHook(() => useItemsPage());
			await act(async () => {
				result.current.handleCreate({
					name: "Ticket",
					currencyId: "c1",
					unitValue: 100,
					description: "<p>notes</p>",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledWith({
				name: "Ticket",
				currencyId: "c1",
				unitValue: 100,
				description: "<p>notes</p>",
			});
		});
	});
});
