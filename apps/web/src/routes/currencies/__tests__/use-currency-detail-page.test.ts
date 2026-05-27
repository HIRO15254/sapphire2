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
	handleLoadMore: vi.fn(),
	navigate: vi.fn(),
	lastExpandedId: null as string | null,
	currencies: [] as Array<{
		id: string;
		name: string;
		unit?: string | null;
		balance: number;
	}>,
	allTransactions: [] as Transaction[],
	txHasMore: false,
	isLoadingMore: false,
	isLoading: false,
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
			txHasMore: mocks.txHasMore,
			isLoadingMore: mocks.isLoadingMore,
			isCreatePending: false,
			isUpdatePending: mocks.isUpdatePending,
			isAddTransactionPending: mocks.isAddTransactionPending,
			isEditTransactionPending: mocks.isEditTransactionPending,
			resetTransactionState: vi.fn(),
			create: vi.fn(),
			update: mocks.update,
			delete: mocks.del,
			addTransaction: mocks.addTransaction,
			editTransaction: mocks.editTransaction,
			deleteTransaction: mocks.deleteTransaction,
			handleLoadMore: mocks.handleLoadMore,
		};
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
}));

import { useCurrencyDetailPage } from "@/routes/currencies/-use-currency-detail-page";

const currencyC1 = {
	id: "c1",
	name: "USD",
	unit: "$",
	balance: 1000,
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
		mocks.handleLoadMore.mockReset();
		mocks.navigate.mockReset();
		mocks.lastExpandedId = null;
		mocks.currencies = [currencyC1];
		mocks.allTransactions = [];
		mocks.txHasMore = false;
		mocks.isLoadingMore = false;
		mocks.isLoading = false;
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
	});

	describe("initial dialog/state", () => {
		it("starts with all dialogs closed and no editing target", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.isEditOpen).toBe(false);
			expect(result.current.isAddTransactionOpen).toBe(false);
			expect(result.current.editingTransaction).toBeNull();
			expect(result.current.confirmingDeleteCurrency).toBe(false);
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

	describe("handleDeleteTransaction", () => {
		it("forwards the id to deleteTransaction()", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			act(() => {
				result.current.handleDeleteTransaction("tx7");
			});
			expect(mocks.deleteTransaction).toHaveBeenCalledWith("tx7");
		});
	});

	describe("handleLoadMore passthrough", () => {
		it("is the same reference returned from the inner hook", () => {
			const { result } = renderHook(() => useCurrencyDetailPage("c1"));
			expect(result.current.handleLoadMore).toBe(mocks.handleLoadMore);
		});
	});
});
