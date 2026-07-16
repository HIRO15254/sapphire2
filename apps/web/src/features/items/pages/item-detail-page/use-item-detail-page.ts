import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import type {
	ItemTransaction,
	ItemTransactionValues,
	ItemValues,
} from "@/features/items/hooks/use-items";
import { useItems } from "@/features/items/hooks/use-items";

export function useItemDetailPage(itemId: string) {
	const [isActionsOpen, setIsActionsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
	const [transactionActionsTarget, setTransactionActionsTarget] =
		useState<ItemTransaction | null>(null);
	const [editingTransaction, setEditingTransaction] =
		useState<ItemTransaction | null>(null);
	const [pendingDeleteTransaction, setPendingDeleteTransaction] =
		useState<ItemTransaction | null>(null);
	const [confirmingDeleteItem, setConfirmingDeleteItem] = useState(false);

	const openEditFromActions = () => {
		setIsActionsOpen(false);
		setIsEditOpen(true);
	};

	const openDeleteFromActions = () => {
		setIsActionsOpen(false);
		setConfirmingDeleteItem(true);
	};

	const openTransactionActions = (transaction: ItemTransaction) => {
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
		items,
		isLoading,
		isInitialLoadError,
		onRetry,
		allTransactions,
		isTransactionsLoading,
		isTransactionsInitialLoadError,
		onRetryTransactions,
		hasNextPage,
		isFetchingNextPage,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		update,
		delete: deleteItem,
		addTransaction,
		editTransaction,
		deleteTransaction,
		fetchNextPage,
	} = useItems(itemId);

	const item = items.find((i) => i.id === itemId) ?? null;

	const handleEdit = (values: ItemValues) => {
		update({ id: itemId, ...values }).then(() => {
			setIsEditOpen(false);
		});
	};

	const handleConfirmDelete = () => {
		deleteItem(itemId)
			.then(() => {
				setConfirmingDeleteItem(false);
				navigate({ to: "/items" });
			})
			.catch((error: unknown) => {
				// The server rejects with CONFLICT while the item still has ledger
				// transactions — surface its message and stay on the page.
				setConfirmingDeleteItem(false);
				toast.error(
					error instanceof Error ? error.message : "Failed to delete item"
				);
			});
	};

	const handleAddTransaction = (values: ItemTransactionValues) => {
		addTransaction({ itemId, ...values }).then(() => {
			setIsAddTransactionOpen(false);
		});
	};

	const handleEditTransaction = (values: ItemTransactionValues) => {
		if (!editingTransaction) {
			return;
		}
		editTransaction({
			id: editingTransaction.id,
			count: values.count,
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
		item,
		isLoading,
		isInitialLoadError,
		onRetry,
		transactions: allTransactions,
		isTransactionsLoading,
		isTransactionsInitialLoadError,
		onRetryTransactions,
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
		confirmingDeleteItem,
		setIsActionsOpen,
		setIsEditOpen,
		setIsAddTransactionOpen,
		setEditingTransaction,
		setConfirmingDeleteItem,
		handleEdit,
		handleConfirmDelete,
		handleAddTransaction,
		handleEditTransaction,
		fetchNextPage,
		openEditFromActions,
		openDeleteFromActions,
		openTransactionActions,
		closeTransactionActions,
		openEditFromTransactionActions,
		openDeleteFromTransactionActions,
		cancelDeleteTransaction,
		handleConfirmDeleteTransaction,
		handleNavigateToSession,
	};
}
