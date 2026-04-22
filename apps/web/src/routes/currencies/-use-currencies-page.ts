import { useState } from "react";
import type {
	CurrencyItem,
	CurrencyValues,
	Transaction,
	TransactionValues,
} from "@/currencies/hooks/use-currencies";
import { useCurrencies } from "@/currencies/hooks/use-currencies";

export function useCurrenciesPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false);
	const [editingCurrency, setEditingCurrency] = useState<CurrencyItem | null>(
		null
	);
	const [expandedCurrencyId, setExpandedCurrencyId] = useState<string | null>(
		null
	);
	const [addTransactionCurrencyId, setAddTransactionCurrencyId] = useState<
		string | null
	>(null);
	const [editingTransaction, setEditingTransaction] =
		useState<Transaction | null>(null);

	const {
		currencies,
		allTransactions,
		txHasMore,
		isLoadingMore,
		isCreatePending,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		resetTransactionState,
		create,
		update,
		delete: deleteCurrency,
		addTransaction,
		editTransaction,
		deleteTransaction,
		handleLoadMore,
	} = useCurrencies(expandedCurrencyId);

	const handleCreate = (values: CurrencyValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleUpdate = (values: CurrencyValues) => {
		if (!editingCurrency) {
			return;
		}
		update({ id: editingCurrency.id, ...values }).then(() => {
			setEditingCurrency(null);
		});
	};

	const handleDelete = (id: string) => {
		deleteCurrency(id).then(() => {
			if (expandedCurrencyId === id) {
				setExpandedCurrencyId(null);
				resetTransactionState();
			}
		});
	};

	const handleAddTransaction = (values: TransactionValues) => {
		if (!addTransactionCurrencyId) {
			return;
		}
		addTransaction({
			currencyId: addTransactionCurrencyId,
			...values,
		}).then(() => {
			setAddTransactionCurrencyId(null);
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

	const handleExpandedCurrencyChange = (id: string | null) => {
		setExpandedCurrencyId((prev) => {
			if (prev !== id) {
				resetTransactionState();
			}
			return id;
		});
	};

	return {
		currencies,
		allTransactions,
		txHasMore,
		isLoadingMore,
		isCreatePending,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		isCreateOpen,
		isTypeManagerOpen,
		editingCurrency,
		expandedCurrencyId,
		addTransactionCurrencyId,
		editingTransaction,
		setIsCreateOpen,
		setIsTypeManagerOpen,
		setEditingCurrency,
		setAddTransactionCurrencyId,
		setEditingTransaction,
		handleCreate,
		handleUpdate,
		handleDelete,
		handleAddTransaction,
		handleEditTransaction,
		handleDeleteTransaction,
		handleExpandedCurrencyChange,
		handleLoadMore,
	};
}
