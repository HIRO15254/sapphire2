import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	transactedAt: string;
	transactionTypeId?: string;
	transactionTypeName: string;
}

const mocks = vi.hoisted(() => ({
	update: vi.fn(),
	del: vi.fn(),
	addTransaction: vi.fn(),
	editTransaction: vi.fn(),
	deleteTransaction: vi.fn(),
	toggleFavorite: vi.fn(),
	fetchNextPage: vi.fn(),
	navigate: vi.fn(),
	lastExpandedId: null as string | null,
	currencies: [] as Array<{
		id: string;
		name: string;
		unit?: string | null;
		balance: number;
		isFavorite: boolean;
		createdAt: string;
	}>,
	allTransactions: [] as Transaction[],
	hasNextPage: false,
	isFetchingNextPage: false,
	isLoading: false,
	isTransactionsLoading: false,
	isUpdatePending: false,
	isAddTransactionPending: false,
	isEditTransactionPending: false,
}));

vi.mock("@/features/currencies/hooks/use-currencies", () => ({
	useCurrencies: (expandedId: string | null) => {
		mocks.lastExpandedId = expandedId;
		return {
			currencies: mocks.currencies,
			isLoading: mocks.isLoading,
			allTransactions: mocks.allTransactions,
			isTransactionsLoading: mocks.isTransactionsLoading,
			hasNextPage: mocks.hasNextPage,
			isFetchingNextPage: mocks.isFetchingNextPage,
			isCreatePending: false,
			isUpdatePending: mocks.isUpdatePending,
			isAddTransactionPending: mocks.isAddTransactionPending,
			isEditTransactionPending: mocks.isEditTransactionPending,
			isToggleFavoritePending: false,
			create: vi.fn(),
			update: mocks.update,
			delete: mocks.del,
			addTransaction: mocks.addTransaction,
			editTransaction: mocks.editTransaction,
			deleteTransaction: mocks.deleteTransaction,
			toggleFavorite: mocks.toggleFavorite,
			fetchNextPage: mocks.fetchNextPage,
		};
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

import { useCurrencyDetailPage } from "@/features/currencies/pages/currency-detail-page/use-currency-detail-page";

const currencyC1 = {
	id: "c1",
	name: "USD",
	unit: "$",
	balance: 1000,
	isFavorite: false,
	createdAt: "2024-01-01T00:00:00.000Z",
};

const editingTxStub: Transaction = {
	id: "tx1",
	amount: 500,
	transactedAt: "2026-03-01",
	transactionTypeId: "t1",
	transactionTypeName: "Deposit",
};

describe("useCurrencyDetailPage", () => {
	beforeEach(() => {
		mocks.update.mockReset().mockResolvedValue({ id: "c1" });
		mocks.del.mockReset().mockResolvedValue({ id: "c1" });
		mocks.addTransaction.mockReset().mockResolvedValue({ id: "tx-new" });
		mocks.editTransaction.mockReset().mockResolvedValue({ id: "tx-1" });
		mocks.deleteTransaction.mockReset();
		mocks.toggleFavorite.mockReset().mockResolvedValue(undefined);
		mocks.fetchNextPage.mockReset();
		mocks.navigate.mockReset();
		mocks.lastExpandedId = null;
		mocks.currencies = [currencyC1];
		mocks.allTransactions = [];
		mocks.hasNextPage = false;
		mocks.isFetchingNextPage = false;
		mocks.isLoading = false;
		mocks.isTransactionsLoading = false;
		mocks.isUpdatePending = false;
		mocks.isAddTransactionPending = false;
		mocks.isEditTransactionPending = false;
	});

	describe("currency lookup", () => {
		it("passes the route id straight through to useCurrencies", () => {
			renderHook(() => useCurrencyDetailPage("c1"));
			expect(mocks.lastExpandedId).toBe("c1");
		});

		it("finds the matching currency by id", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.currency).toEqual(currencyC1);
		});

		it("returns null when no currency in the list matches", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("missing"));
			expect(result.current.currency).toBeNull();
		});

		it("exposes the loading flag from the inner hook", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.isLoading).toBe(true);
		});

		it("forwards the transactions loading flag from the inner hook", () => {
			mocks.isTransactionsLoading = true;
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.isTransactionsLoading).toBe(true);
		});

		it("transactions loading flag is false when the inner hook is settled", () => {
			mocks.isTransactionsLoading = false;
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.isTransactionsLoading).toBe(false);
		});

		it("currency.isFavorite is false for a non-favorited currency", () => {
			mocks.currencies = [{ ...currencyC1, isFavorite: false }];
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.currency?.isFavorite).toBe(false);
		});

		it("currency.isFavorite is true for a favorited currency", () => {
			mocks.currencies = [{ ...currencyC1, isFavorite: true }];
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.currency?.isFavorite).toBe(true);
		});
	});

	describe("initial dialog/state", () => {
		it("starts with all dialogs closed and no editing target", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.isEditOpen).toBe(false);
			expect(result.current.isAddTransactionOpen).toBe(false);
			expect(result.current.editingTransaction).toBeNull();
			expect(result.current.confirmingDeleteCurrency).toBe(false);
		});
	});

	describe("actions bottom sheet", () => {
		it("opens via setIsActionsOpen", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			expect(result.current.isActionsOpen).toBe(true);
		});

		it("openEditFromActions closes the actions sheet and opens edit", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
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
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			act(() => {
				result.current.openDeleteFromActions();
			});
			expect(result.current.isActionsOpen).toBe(false);
			expect(result.current.confirmingDeleteCurrency).toBe(true);
		});
	});

	describe("handleEdit", () => {
		it("merges the route id and forwards to update()", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			await act(async () => {
				result.current.handleEdit({ name: "USD2", unit: "$" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "c1",
				name: "USD2",
				unit: "$",
			});
		});

		it("forwards the rich-text description to update()", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			await act(async () => {
				result.current.handleEdit({
					name: "USD2",
					unit: "$",
					description: "<p>memo</p>",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "c1",
				name: "USD2",
				unit: "$",
				description: "<p>memo</p>",
			});
		});

		it("closes the edit dialog on success", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setIsEditOpen(true);
			});
			await act(async () => {
				result.current.handleEdit({ name: "x" });
				await Promise.resolve();
				await Promise.resolve();
			});
			await waitFor(() => expect(result.current.isEditOpen).toBe(false));
		});
	});

	describe("handleConfirmDelete", () => {
		it("calls delete with the route id, closes the prompt, and navigates back", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setConfirmingDeleteCurrency(true);
			});
			await act(async () => {
				result.current.handleConfirmDelete();
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.del).toHaveBeenCalledWith("c1");
			await waitFor(() =>
				expect(result.current.confirmingDeleteCurrency).toBe(false)
			);
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			expect(mocks.navigate).toHaveBeenCalledWith({ to: "/currencies" });
		});
	});

	describe("handleAddTransaction", () => {
		it("attaches the route currencyId and forwards to addTransaction()", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			await act(async () => {
				result.current.handleAddTransaction({
					amount: 100,
					transactedAt: "2026-04-24",
					transactionTypeId: "t1",
					memo: "note",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.addTransaction).toHaveBeenCalledWith({
				amount: 100,
				transactedAt: "2026-04-24",
				transactionTypeId: "t1",
				memo: "note",
				currencyId: "c1",
			});
		});

		it("closes the add dialog on success", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setIsAddTransactionOpen(true);
			});
			await act(async () => {
				result.current.handleAddTransaction({
					amount: 1,
					transactedAt: "2026-04-24",
					transactionTypeId: "t",
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
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.handleEditTransaction({
					amount: 1,
					transactedAt: "2026-04-24",
					transactionTypeId: "t",
				});
			});
			expect(mocks.editTransaction).not.toHaveBeenCalled();
		});

		it("forwards memo ?? null when memo is omitted", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setEditingTransaction(editingTxStub);
			});
			await act(async () => {
				result.current.handleEditTransaction({
					amount: 900,
					transactedAt: "2026-04-02",
					transactionTypeId: "t2",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.editTransaction).toHaveBeenCalledWith({
				id: "tx1",
				transactionTypeId: "t2",
				amount: 900,
				transactedAt: "2026-04-02",
				memo: null,
			});
			await waitFor(() => expect(result.current.editingTransaction).toBeNull());
		});

		it("forwards the provided memo verbatim", async () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setEditingTransaction(editingTxStub);
			});
			await act(async () => {
				result.current.handleEditTransaction({
					amount: 200,
					transactedAt: "2026-04-10",
					transactionTypeId: "t3",
					memo: "updated",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.editTransaction).toHaveBeenCalledWith({
				id: "tx1",
				transactionTypeId: "t3",
				amount: 200,
				transactedAt: "2026-04-10",
				memo: "updated",
			});
		});
	});

	describe("transaction actions flow", () => {
		it("starts with no actions target", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.transactionActionsTarget).toBeNull();
			expect(result.current.pendingDeleteTransaction).toBeNull();
		});

		it("openTransactionActions sets the target", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			expect(result.current.transactionActionsTarget).toBe(editingTxStub);
		});

		it("closeTransactionActions clears the target", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.openTransactionActions(editingTxStub);
			});
			act(() => {
				result.current.closeTransactionActions();
			});
			expect(result.current.transactionActionsTarget).toBeNull();
		});

		it("openEditFromTransactionActions promotes the target into editingTransaction", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
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
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
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
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
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
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
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
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.handleConfirmDeleteTransaction();
			});
			expect(mocks.deleteTransaction).not.toHaveBeenCalled();
		});
	});

	describe("fetchNextPage passthrough", () => {
		it("is the same reference returned from the inner hook", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.fetchNextPage).toBe(mocks.fetchNextPage);
		});
	});

	describe("handleNavigateToSession", () => {
		it("navigates to the session detail page with the given sessionId", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
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

	describe("handleToggleFavorite", () => {
		it("calls toggleFavorite with the currencyId", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.handleToggleFavorite();
			});
			expect(mocks.toggleFavorite).toHaveBeenCalledTimes(1);
			expect(mocks.toggleFavorite).toHaveBeenCalledWith("c1");
		});

		it("closes the actions drawer when called", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.setIsActionsOpen(true);
			});
			expect(result.current.isActionsOpen).toBe(true);
			act(() => {
				result.current.handleToggleFavorite();
			});
			expect(result.current.isActionsOpen).toBe(false);
		});
	});
});
