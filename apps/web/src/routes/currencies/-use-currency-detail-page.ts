import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type {
	CurrencyValues,
	Transaction,
	TransactionValues,
} from "@/features/currencies/hooks/use-currencies";
import { useCurrencies } from "@/features/currencies/hooks/use-currencies";

export interface CurrencyDetailItem {
	balance: number;
	id: string;
	name: string;
	unit?: string | null;
}

export function useCurrencyDetailPage(currencyId: string) {
	const [isActionsOpen, setIsActionsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
	const [editingTransaction, setEditingTransaction] =
		useState<Transaction | null>(null);
	const [confirmingDeleteCurrency, setConfirmingDeleteCurrency] =
		useState(false);

	const openEditFromActions = () => {
		setIsActionsOpen(false);
		setIsEditOpen(true);
	};

	const openDeleteFromActions = () => {
		setIsActionsOpen(false);
		setConfirmingDeleteCurrency(true);
	};

	const navigate = useNavigate();

	const {
		currencies,
		isLoading,
		allTransactions,
		txHasMore,
		isLoadingMore,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		update,
		delete: deleteCurrency,
		addTransaction,
		editTransaction,
		deleteTransaction,
		handleLoadMore,
	} = useCurrencies(currencyId);

	const currency = currencies.find((c) => c.id === currencyId) ?? null;

	const handleEdit = (values: CurrencyValues) => {
		update({ id: currencyId, ...values }).then(() => {
			setIsEditOpen(false);
		});
	};

	const handleConfirmDelete = () => {
		deleteCurrency(currencyId).then(() => {
			setConfirmingDeleteCurrency(false);
			navigate({ to: "/currencies" });
		});
	};

	const handleAddTransaction = (values: TransactionValues) => {
		addTransaction({ currencyId, ...values }).then(() => {
			setIsAddTransactionOpen(false);
		});
	};

	const handleEditTransaction = (values: TransactionValues) => {
		if (!editingTransaction) {
			return;
		}
		editTransaction({
			id: editingTransaction.id,
			transactionTypeId: values.transactionTypeId,
			amount: values.amount,
			transactedAt: values.transactedAt,
			memo: values.memo ?? null,
		}).then(() => {
			setEditingTransaction(null);
		});
	};

	const handleDeleteTransaction = (id: string) => {
		deleteTransaction(id);
	};

	return {
		currency,
		isLoading,
		transactions: allTransactions,
		txHasMore,
		isLoadingMore,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		isActionsOpen,
		isEditOpen,
		isAddTransactionOpen,
		editingTransaction,
		confirmingDeleteCurrency,
		setIsActionsOpen,
		setIsEditOpen,
		setIsAddTransactionOpen,
		setEditingTransaction,
		setConfirmingDeleteCurrency,
		handleEdit,
		handleConfirmDelete,
		handleAddTransaction,
		handleEditTransaction,
		handleDeleteTransaction,
		handleLoadMore,
		openEditFromActions,
		openDeleteFromActions,
	};
}
