import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface ItemTransaction {
	count: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	sessionName?: string | null;
	transactedAt: string;
}

const mocks = vi.hoisted(() => ({
	update: vi.fn(),
	del: vi.fn(),
	addTransaction: vi.fn(),
	editTransaction: vi.fn(),
	deleteTransaction: vi.fn(),
	fetchNextPage: vi.fn(),
	navigate: vi.fn(),
	toastError: vi.fn(),
	lastExpandedId: null as string | null,
	items: [] as Array<{
		currencyId: string;
		currencyName?: string | null;
		currencyUnit?: string | null;
		description?: string | null;
		holdings: number;
		id: string;
		name: string;
		unitValue: number;
	}>,
	allTransactions: [] as ItemTransaction[],
	hasNextPage: false,
	isFetchingNextPage: false,
	isLoading: false,
	isInitialLoadError: false,
	onRetry: vi.fn(),
	isTransactionsLoading: false,
	isUpdatePending: false,
	isAddTransactionPending: false,
	isEditTransactionPending: false,
}));

vi.mock("@/features/items/hooks/use-items", () => ({
	useItems: (expandedId: string | null) => {
		mocks.lastExpandedId = expandedId;
		return {
			items: mocks.items,
			isLoading: mocks.isLoading,
			isInitialLoadError: mocks.isInitialLoadError,
			onRetry: mocks.onRetry,
			allTransactions: mocks.allTransactions,
			isTransactionsLoading: mocks.isTransactionsLoading,
			hasNextPage: mocks.hasNextPage,
			isFetchingNextPage: mocks.isFetchingNextPage,
			isCreatePending: false,
			isUpdatePending: mocks.isUpdatePending,
			isAddTransactionPending: mocks.isAddTransactionPending,
			isEditTransactionPending: mocks.isEditTransactionPending,
			create: vi.fn(),
			update: mocks.update,
			delete: mocks.del,
			addTransaction: mocks.addTransaction,
			editTransaction: mocks.editTransaction,
			deleteTransaction: mocks.deleteTransaction,
			fetchNextPage: mocks.fetchNextPage,
		};
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
	toast: {
		error: mocks.toastError,
	},
}));

import { useItemDetailPage } from "@/features/items/pages/item-detail-page/use-item-detail-page";

const itemI1 = {
	id: "i1",
	name: "Ticket",
	currencyId: "c1",
	currencyName: "USD",
	currencyUnit: "$",
	unitValue: 100,
	description: null as string | null,
	holdings: 3,
};

const editingTxStub: ItemTransaction = {
	id: "tx1",
	count: 2,
	transactedAt: "2026-03-01",
	sessionId: null,
	sessionName: null,
};

describe("useItemDetailPage", () => {
	beforeEach(() => {
		mocks.update.mockReset().mockResolvedValue({ id: "i1" });
		mocks.del.mockReset().mockResolvedValue({ success: true });
		mocks.addTransaction.mockReset().mockResolvedValue({ id: "tx-new" });
		mocks.editTransaction.mockReset().mockResolvedValue({ id: "tx-1" });
		mocks.deleteTransaction.mockReset();
		mocks.fetchNextPage.mockReset();
		mocks.navigate.mockReset();
		mocks.toastError.mockReset();
		mocks.lastExpandedId = null;
		mocks.items = [itemI1];
		mocks.allTransactions = [];
		mocks.hasNextPage = false;
		mocks.isFetchingNextPage = false;
		mocks.isLoading = false;
		mocks.isInitialLoadError = false;
		mocks.onRetry.mockReset();
		mocks.isTransactionsLoading = false;
		mocks.isUpdatePending = false;
		mocks.isAddTransactionPending = false;
		mocks.isEditTransactionPending = false;
	});

	describe("item lookup", () => {
		it("passes the route id straight through to useItems", () => {
			renderHook(() => useItemDetailPage("i1"));
			expect(mocks.lastExpandedId).toBe("i1");
		});

		it("finds the matching item by id", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.item).toEqual(itemI1);
		});

		it("returns null when no item in the list matches", () => {
			const { result } = renderHook(() => useItemDetailPage("missing"));
			expect(result.current.item).toBeNull();
		});

		it("exposes the loading flag from the inner hook", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.isLoading).toBe(true);
		});

		it("forwards the initial-load error state and retry callback", () => {
			mocks.isInitialLoadError = true;
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.isInitialLoadError).toBe(true);
			expect(result.current.onRetry).toBe(mocks.onRetry);
		});

		it("forwards the transactions loading flag from the inner hook", () => {
			mocks.isTransactionsLoading = true;
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.isTransactionsLoading).toBe(true);
		});

		it("transactions loading flag is false when the inner hook is settled", () => {
			mocks.isTransactionsLoading = false;
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.isTransactionsLoading).toBe(false);
		});
	});

	describe("initial dialog/state", () => {
		it("starts with all dialogs closed and no editing target", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.isEditOpen).toBe(false);
			expect(result.current.isAddTransactionOpen).toBe(false);
			expect(result.current.editingTransaction).toBeNull();
			expect(result.current.confirmingDeleteItem).toBe(false);
		});
	});

	describe("actions bottom sheet", () => {
		it("opens via setIsActionsOpen", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			expect(result.current.isActionsOpen).toBe(true);
		});

		it("openEditFromActions closes the actions sheet and opens edit", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			act(() => {
				result.current.openEditFromActions();
			});
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.isEditOpen).toBe(true);
		});

		it("openDeleteFromActions closes the actions sheet and opens delete confirm", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			act(() => {
				result.current.openDeleteFromActions();
			});
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.confirmingDeleteItem).toBe(true);
		});
	});

	describe("handleEdit", () => {
		it("merges the route id and forwards to update()", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			await act(async () => {
				result.current.handleEdit({
					name: "Ticket 2",
					currencyId: "c2",
					unitValue: 200,
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "i1",
				name: "Ticket 2",
				currencyId: "c2",
				unitValue: 200,
			});
		});

		it("forwards the rich-text description to update()", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			await act(async () => {
				result.current.handleEdit({
					name: "Ticket 2",
					currencyId: "c1",
					unitValue: 100,
					description: "<p>memo</p>",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "i1",
				name: "Ticket 2",
				currencyId: "c1",
				unitValue: 100,
				description: "<p>memo</p>",
			});
		});

		it("closes the edit dialog on success", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setIsEditOpen(true);
			});
			await act(async () => {
				result.current.handleEdit({
					name: "x",
					currencyId: "c1",
					unitValue: 1,
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isEditOpen).toBe(false));
		});
	});

	describe("handleConfirmDelete", () => {
		it("calls delete with the route id, closes the prompt, and navigates back", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setConfirmingDeleteItem(true);
			});
			await act(async () => {
				result.current.handleConfirmDelete();
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.del).toHaveBeenCalledWith("i1");
			await waitFor(() =>
				expect(result.current.confirmingDeleteItem).toBe(false)
			);
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/items" });
			expect(mocks.toastError).not.toHaveBeenCalled();
		});

		it("surfaces the server CONFLICT message as a toast and stays on the page when delete fails", async () => {
			mocks.del.mockRejectedValue(
				new Error("Item cannot be deleted while it has transactions")
			);
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setConfirmingDeleteItem(true);
			});
			await act(async () => {
				result.current.handleConfirmDelete();
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() =>
				expect(result.current.confirmingDeleteItem).toBe(false)
			);
			expect(mocks.toastError).toHaveBeenCalledTimes(1);
			expect(mocks.toastError).toHaveBeenCalledWith(
				"Item cannot be deleted while it has transactions"
			);
			expect(mocks.navigate).not.toHaveBeenCalled();
		});

		it("falls back to a generic toast message for a non-Error rejection", async () => {
			mocks.del.mockRejectedValue("boom");
			const { result } = renderHook(() => useItemDetailPage("i1"));
			await act(async () => {
				result.current.handleConfirmDelete();
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
			expect(mocks.toastError).toHaveBeenCalledWith("Failed to delete item");
		});
	});

	describe("handleAddTransaction", () => {
		it("attaches the route itemId and forwards to addTransaction()", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			await act(async () => {
				result.current.handleAddTransaction({
					count: 2,
					transactedAt: "2026-04-24",
					memo: "note",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.addTransaction).toHaveBeenCalledWith({
				count: 2,
				transactedAt: "2026-04-24",
				memo: "note",
				itemId: "i1",
			});
		});

		it("closes the add dialog on success", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setIsAddTransactionOpen(true);
			});
			await act(async () => {
				result.current.handleAddTransaction({
					count: 1,
					transactedAt: "2026-04-24",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() =>
				expect(result.current.isAddTransactionOpen).toBe(false)
			);
		});
	});

	describe("handleEditTransaction", () => {
		it("is a no-op when editingTransaction is null", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.handleEditTransaction({
					count: 1,
					transactedAt: "2026-04-24",
				});
			});
			expect(mocks.editTransaction).not.toHaveBeenCalled();
		});

		it("forwards memo ?? null when memo is omitted", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setEditingTransaction(editingTxStub);
			});
			await act(async () => {
				result.current.handleEditTransaction({
					count: -3,
					transactedAt: "2026-04-02",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.editTransaction).toHaveBeenCalledWith({
				id: "tx1",
				count: -3,
				transactedAt: "2026-04-02",
				memo: null,
			});
			await waitFor(() => expect(result.current.editingTransaction).toBeNull());
		});

		it("forwards the provided memo verbatim", async () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.setEditingTransaction(editingTxStub);
			});
			await act(async () => {
				result.current.handleEditTransaction({
					count: 5,
					transactedAt: "2026-04-10",
					memo: "updated",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.editTransaction).toHaveBeenCalledWith({
				id: "tx1",
				count: 5,
				transactedAt: "2026-04-10",
				memo: "updated",
			});
		});
	});

	describe("transaction actions flow", () => {
		it("starts with no actions target", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.transactionActionsTarget).toBeNull();
			expect(result.current.pendingDeleteTransaction).toBeNull();
		});

		it("openTransactionActions sets the target", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			expect(result.current.transactionActionsTarget).toBe(editingTxStub);
		});

		it("closeTransactionActions clears the target", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			act(() => {
				result.current.closeTransactionActions();
			});
			expect(result.current.transactionActionsTarget).toBeNull();
		});

		it("openEditFromTransactionActions promotes the target into editingTransaction", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			act(() => {
				result.current.openEditFromTransactionActions();
			});
			expect(result.current.editingTransaction).toBe(editingTxStub);
			expect(result.current.transactionActionsTarget).toBeNull();
		});

		it("openDeleteFromTransactionActions promotes the target into pendingDeleteTransaction", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			act(() => {
				result.current.openDeleteFromTransactionActions();
			});
			expect(result.current.pendingDeleteTransaction).toBe(editingTxStub);
			expect(result.current.transactionActionsTarget).toBeNull();
		});

		it("cancelDeleteTransaction clears the pending delete target", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			act(() => {
				result.current.openDeleteFromTransactionActions();
			});
			act(() => {
				result.current.cancelDeleteTransaction();
			});
			expect(result.current.pendingDeleteTransaction).toBeNull();
			expect(mocks.deleteTransaction).not.toHaveBeenCalled();
		});

		it("handleConfirmDeleteTransaction deletes the pending target and clears state", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			act(() => {
				result.current.openDeleteFromTransactionActions();
			});
			act(() => {
				result.current.handleConfirmDeleteTransaction();
			});
			expect(mocks.deleteTransaction).toHaveBeenCalledWith(editingTxStub.id);
			expect(result.current.pendingDeleteTransaction).toBeNull();
		});

		it("handleConfirmDeleteTransaction is a no-op without a pending target", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.handleConfirmDeleteTransaction();
			});
			expect(mocks.deleteTransaction).not.toHaveBeenCalled();
		});
	});

	describe("fetchNextPage passthrough", () => {
		it("is the same reference returned from the inner hook", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			expect(result.current.fetchNextPage).toBe(mocks.fetchNextPage);
		});
	});

	describe("handleNavigateToSession", () => {
		it("navigates to the session detail page with the given sessionId", () => {
			const { result } = renderHook(() => useItemDetailPage("i1"));
			act(() => {
				result.current.handleNavigateToSession("session-abc");
			});
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({
				to: "/sessions/$sessionId",
				params: { sessionId: "session-abc" },
			});
		});
	});
});
