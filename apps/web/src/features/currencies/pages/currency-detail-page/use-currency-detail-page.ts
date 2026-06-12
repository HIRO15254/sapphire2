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
	description?: string | null;
	id: string;
	isFavorite: boolean;
	name: string;
	unit?: string | null;
}

export function useCurrencyDetailPage(currencyId: string) {
	const [isActionsOpen, setIsActionsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
	const [transactionActionsTarget, setTransactionActionsTarget] =
		useState<Transaction | null>(null);
	const [editingTransaction, setEditingTransaction] =
		useState<Transaction | null>(null);
	const [pendingDeleteTransaction, setPendingDeleteTransaction] =
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

	const handleToggleFavorite = () => {
		setIsActionsOpen(false);
		toggleFavorite(currencyId);
	};

	const openTransactionActions = (transaction: Transaction) => {
		setTransactionActionsTarget(transaction);
	};

	const closeTransactionActions = () => {
		setTransactionActionsTarget(null);
	};

	const openEditFromTransactionActions = () => {
		if (transactionActionsTarget) {
			setEditingTransaction(transactionActionsTarget);
		}
		setTransactionActionsTarget(null);
	};

	const openDeleteFromTransactionActions = () => {
		if (transactionActionsTarget) {
			setPendingDeleteTransaction(transactionActionsTarget);
		}
		setTransactionActionsTarget(null);
	};

	const cancelDeleteTransaction = () => {
		setPendingDeleteTransaction(null);
	};

	const navigate = useNavigate();

	const {
		currencies,
		isLoading,
		allTransactions,
		isTransactionsLoading,
		hasNextPage,
		isFetchingNextPage,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		update,
		delete: deleteCurrency,
		addTransaction,
		editTransaction,
		deleteTransaction,
		toggleFavorite,
		fetchNextPage,
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

	const handleConfirmDeleteTransaction = () => {
		if (!pendingDeleteTransaction) {
			return;
		}
		deleteTransaction(pendingDeleteTransaction.id);
		setPendingDeleteTransaction(null);
	};

	const handleNavigateToSession = (sessionId: string) => {
		navigate({ to: "/sessions/$sessionId", params: { sessionId } });
	};

	return {
		currency,
		isLoading,
		transactions: allTransactions,
		isTransactionsLoading,
		hasNextPage,
		isFetchingNextPage,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		isActionsOpen,
		isEditOpen,
		isAddTransactionOpen,
		transactionActionsTarget,
		editingTransaction,
		pendingDeleteTransaction,
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
		fetchNextPage,
		openEditFromActions,
		openDeleteFromActions,
		handleToggleFavorite,
		openTransactionActions,
		closeTransactionActions,
		openEditFromTransactionActions,
		openDeleteFromTransactionActions,
		cancelDeleteTransaction,
		handleConfirmDeleteTransaction,
		handleNavigateToSession,
	};
}
