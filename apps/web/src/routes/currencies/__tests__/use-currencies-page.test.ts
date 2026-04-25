import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Currency {
	id: string;
	name: string;
	unit?: string | null;
}
interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	transactedAt: string;
	transactionTypeId?: string;
	transactionTypeName: string;
}

const mocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
	addTransaction: vi.fn(),
	editTransaction: vi.fn(),
	deleteTransaction: vi.fn(),
	resetTransactionState: vi.fn(),
	handleLoadMore: vi.fn(),
	lastExpandedId: null as string | null,
	currencies: [] as Array<{ id: string; name: string; unit?: string | null }>,
	allTransactions: [] as Transaction[],
	txHasMore: false,
	isLoadingMore: false,
	isCreatePending: false,
	isUpdatePending: false,
	isAddTransactionPending: false,
	isEditTransactionPending: false,
}));

vi.mock("@/features/currencies/hooks/use-currencies", () => ({
	useCurrencies: (expandedId: string | null) => {
		mocks.lastExpandedId = expandedId;
		return {
			currencies: mocks.currencies,
			allTransactions: mocks.allTransactions,
			txHasMore: mocks.txHasMore,
			isLoadingMore: mocks.isLoadingMore,
			isCreatePending: mocks.isCreatePending,
			isUpdatePending: mocks.isUpdatePending,
			isAddTransactionPending: mocks.isAddTransactionPending,
			isEditTransactionPending: mocks.isEditTransactionPending,
			resetTransactionState: mocks.resetTransactionState,
			create: mocks.create,
			update: mocks.update,
			delete: mocks.del,
			addTransaction: mocks.addTransaction,
			editTransaction: mocks.editTransaction,
			deleteTransaction: mocks.deleteTransaction,
			handleLoadMore: mocks.handleLoadMore,
		};
	},
}));

import { useCurrenciesPage } from "@/routes/currencies/-use-currencies-page";

const currency: Currency = { id: "c1", name: "USD", unit: "$" };

describe("useCurrenciesPage", () => {
	beforeEach(() => {
		mocks.create.mockReset().mockResolvedValue({ id: "new" });
		mocks.update.mockReset().mockResolvedValue({ id: "c1" });
		mocks.del.mockReset().mockResolvedValue({ id: "c1" });
		mocks.addTransaction.mockReset().mockResolvedValue({ id: "tx-new" });
		mocks.editTransaction.mockReset().mockResolvedValue({ id: "tx-1" });
		mocks.deleteTransaction.mockReset();
		mocks.resetTransactionState.mockReset();
		mocks.handleLoadMore.mockReset();
		mocks.lastExpandedId = null;
		mocks.currencies = [];
		mocks.allTransactions = [];
		mocks.txHasMore = false;
		mocks.isLoadingMore = false;
		mocks.isCreatePending = false;
		mocks.isUpdatePending = false;
		mocks.isAddTransactionPending = false;
		mocks.isEditTransactionPending = false;
	});

	describe("initial state", () => {
		it("has all dialogs closed and no editing targets by default", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.isCreateOpen).toBe(false);
			expect(result.current.isTypeManagerOpen).toBe(false);
			expect(result.current.editingCurrency).toBeNull();
			expect(result.current.expandedCurrencyId).toBeNull();
			expect(result.current.addTransactionCurrencyId).toBeNull();
			expect(result.current.editingTransaction).toBeNull();
		});

		it("passes null expandedCurrencyId into useCurrencies initially", () => {
			renderHook(() => useCurrenciesPage());
			expect(mocks.lastExpandedId).toBeNull();
		});
	});

	describe("handleCreate", () => {
		it("calls create with values and closes the dialog on success", async () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.setIsCreateOpen(true);
			});
			await act(async () => {
				result.current.handleCreate({ name: "JPY", unit: "¥" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.create).toHaveBeenCalledWith({ name: "JPY", unit: "¥" });
			await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
		});
	});

	describe("handleUpdate", () => {
		it("is a no-op when editingCurrency is null", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleUpdate({ name: "x" });
			});
			expect(mocks.update).not.toHaveBeenCalled();
		});

		it("merges id and clears editingCurrency on success", async () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.setEditingCurrency(currency);
			});
			await act(async () => {
				result.current.handleUpdate({ name: "USD2", unit: "$" });
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.update).toHaveBeenCalledWith({
				id: "c1",
				name: "USD2",
				unit: "$",
			});
			await waitFor(() => expect(result.current.editingCurrency).toBeNull());
		});
	});

	describe("handleDelete", () => {
		it("calls delete with the id (expanded is different currency → no reset)", async () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleExpandedCurrencyChange("c2");
			});
			await act(async () => {
				result.current.handleDelete("c1");
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.del).toHaveBeenCalledWith("c1");
			// The expanded id was "c2", not "c1", so state should not reset via this path
			expect(result.current.expandedCurrencyId).toBe("c2");
		});

		it("resets expansion + transactions when deleting the expanded currency", async () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleExpandedCurrencyChange("c1");
			});
			await act(async () => {
				result.current.handleDelete("c1");
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.del).toHaveBeenCalledWith("c1");
			await waitFor(() => expect(result.current.expandedCurrencyId).toBeNull());
			expect(mocks.resetTransactionState).toHaveBeenCalled();
		});
	});

	describe("handleAddTransaction", () => {
		it("is a no-op when addTransactionCurrencyId is null", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleAddTransaction({
					amount: 1,
					transactedAt: "2026-04-24",
					transactionTypeId: "t",
				});
			});
			expect(mocks.addTransaction).not.toHaveBeenCalled();
		});

		it("forwards payload with currencyId then clears the target on success", async () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.setAddTransactionCurrencyId("c1");
			});
			await act(async () => {
				result.current.handleAddTransaction({
					amount: 1000,
					transactedAt: "2026-04-24",
					transactionTypeId: "deposit",
					memo: "note",
				});
				await Promise.resolve();
				await Promise.resolve();
			});
			expect(mocks.addTransaction).toHaveBeenCalledWith({
				amount: 1000,
				transactedAt: "2026-04-24",
				transactionTypeId: "deposit",
				memo: "note",
				currencyId: "c1",
			});
			await waitFor(() =>
				expect(result.current.addTransactionCurrencyId).toBeNull()
			);
		});
	});

	describe("handleEditTransaction", () => {
		it("is a no-op when editingTransaction is null", () => {
			const { result } = renderHook(() => useCurrenciesPage());
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
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.setEditingTransaction({
					id: "tx1",
					amount: 500,
					transactedAt: "2026-03-01",
					transactionTypeName: "Deposit",
				});
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
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.setEditingTransaction({
					id: "tx2",
					amount: 100,
					transactedAt: "2026-04-01",
					transactionTypeName: "Withdrawal",
				});
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
				id: "tx2",
				transactionTypeId: "t3",
				amount: 200,
				transactedAt: "2026-04-10",
				memo: "updated",
			});
		});
	});

	describe("handleDeleteTransaction", () => {
		it("forwards the id", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleDeleteTransaction("tx1");
			});
			expect(mocks.deleteTransaction).toHaveBeenCalledWith("tx1");
		});
	});

	describe("handleExpandedCurrencyChange", () => {
		it("stores the new expanded id when it differs from previous", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleExpandedCurrencyChange("c1");
			});
			expect(result.current.expandedCurrencyId).toBe("c1");
			expect(mocks.resetTransactionState).toHaveBeenCalledTimes(1);
		});

		it("does not reset when the same id is set again", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleExpandedCurrencyChange("c1");
			});
			mocks.resetTransactionState.mockClear();
			act(() => {
				result.current.handleExpandedCurrencyChange("c1");
			});
			expect(mocks.resetTransactionState).not.toHaveBeenCalled();
		});

		it("resets when switching from a non-null to a different id", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleExpandedCurrencyChange("c1");
			});
			mocks.resetTransactionState.mockClear();
			act(() => {
				result.current.handleExpandedCurrencyChange("c2");
			});
			expect(result.current.expandedCurrencyId).toBe("c2");
			expect(mocks.resetTransactionState).toHaveBeenCalledTimes(1);
		});

		it("collapses via null and resets transaction state", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			act(() => {
				result.current.handleExpandedCurrencyChange("c1");
			});
			mocks.resetTransactionState.mockClear();
			act(() => {
				result.current.handleExpandedCurrencyChange(null);
			});
			expect(result.current.expandedCurrencyId).toBeNull();
			expect(mocks.resetTransactionState).toHaveBeenCalledTimes(1);
		});
	});

	describe("passthrough handleLoadMore", () => {
		it("is the same reference returned from the inner hook", () => {
			const { result } = renderHook(() => useCurrenciesPage());
			expect(result.current.handleLoadMore).toBe(mocks.handleLoadMore);
		});
	});
});
