import { IconCoins, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CurrencyCard } from "@/components/stores/currency-card";
import { CurrencyForm } from "@/components/stores/currency-form";
import { TransactionForm } from "@/components/stores/transaction-form";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/currencies/")({
	component: CurrenciesPage,
});

interface CurrencyValues {
	name: string;
	unit?: string;
}

interface TransactionValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

interface CurrencyItem {
	id: string;
	name: string;
	unit?: string | null;
}

interface Transaction {
	amount: number;
	createdAt?: Date | string;
	currencyId?: string;
	id: string;
	memo?: string | null;
	transactedAt: Date | string;
	transactionTypeId?: string;
	transactionTypeName: string;
}

function CurrenciesPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
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

	const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
	const [txCursor, setTxCursor] = useState<string | undefined>(undefined);
	const [txHasMore, setTxHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	const queryClient = useQueryClient();
	const currencyListKey = trpc.currency.list.queryOptions().queryKey;

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const transactionsQueryOptions =
		trpc.currencyTransaction.listByCurrency.queryOptions(
			{ currencyId: expandedCurrencyId ?? "" },
			{ enabled: expandedCurrencyId !== null }
		);

	const transactionsQuery = useQuery(transactionsQueryOptions);

	useEffect(() => {
		if (transactionsQuery.data) {
			setAllTransactions(transactionsQuery.data.items);
			setTxCursor(transactionsQuery.data.nextCursor);
			setTxHasMore(transactionsQuery.data.nextCursor !== undefined);
		}
	}, [transactionsQuery.data]);

	const resetTransactionState = () => {
		setAllTransactions([]);
		setTxCursor(undefined);
		setTxHasMore(false);
		setIsLoadingMore(false);
	};

	const createMutation = useMutation({
		mutationFn: (values: CurrencyValues) =>
			trpcClient.currency.create.mutate(values),
		onMutate: async (newCurrency) => {
			await queryClient.cancelQueries({ queryKey: currencyListKey });
			const previous = queryClient.getQueryData(currencyListKey);
			queryClient.setQueryData(currencyListKey, (old) => {
				if (!old) {
					return old;
				}
				const now = new Date().toISOString();
				return [
					...old,
					{
						id: `temp-${Date.now()}`,
						name: newCurrency.name,
						unit: newCurrency.unit ?? null,
						balance: 0,
						createdAt: now,
						updatedAt: now,
						userId: "",
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(currencyListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey });
		},
		onSuccess: () => {
			setIsCreateOpen(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: CurrencyValues & { id: string }) =>
			trpcClient.currency.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: currencyListKey });
			const previous = queryClient.getQueryData(currencyListKey);
			queryClient.setQueryData(currencyListKey, (old) =>
				old?.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(currencyListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey });
		},
		onSuccess: () => {
			setEditingCurrency(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.currency.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: currencyListKey });
			const previous = queryClient.getQueryData(currencyListKey);
			queryClient.setQueryData(currencyListKey, (old) =>
				old?.filter((c) => c.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(currencyListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey });
		},
		onSuccess: (_data, id) => {
			if (expandedCurrencyId === id) {
				setExpandedCurrencyId(null);
				resetTransactionState();
			}
		},
	});

	const addTransactionMutation = useMutation({
		mutationFn: (values: TransactionValues & { currencyId: string }) =>
			trpcClient.currencyTransaction.create.mutate(values),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey });
			queryClient.invalidateQueries({
				queryKey: transactionsQueryOptions.queryKey,
			});
		},
		onSuccess: () => {
			resetTransactionState();
			setAddTransactionCurrencyId(null);
		},
	});

	const editTransactionMutation = useMutation({
		mutationFn: (values: {
			amount: number;
			id: string;
			memo: string | null;
			transactedAt: string;
			transactionTypeId: string;
		}) =>
			trpcClient.currencyTransaction.update.mutate({
				id: values.id,
				transactionTypeId: values.transactionTypeId,
				amount: values.amount,
				transactedAt: values.transactedAt,
				memo: values.memo,
			}),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey });
			queryClient.invalidateQueries({
				queryKey: transactionsQueryOptions.queryKey,
			});
		},
		onSuccess: () => {
			resetTransactionState();
			setEditingTransaction(null);
		},
	});

	const deleteTransactionMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.currencyTransaction.delete.mutate({ id }),
		onMutate: (id) => {
			const previous = allTransactions;
			setAllTransactions((prev) => prev.filter((t) => t.id !== id));
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				setAllTransactions(context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey });
			queryClient.invalidateQueries({
				queryKey: transactionsQueryOptions.queryKey,
			});
		},
		onSuccess: () => {
			resetTransactionState();
		},
	});

	const handleCreate = (values: CurrencyValues) => {
		createMutation.mutate(values);
	};

	const handleUpdate = (values: CurrencyValues) => {
		if (!editingCurrency) {
			return;
		}
		updateMutation.mutate({ id: editingCurrency.id, ...values });
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate(id);
	};

	const handleAddTransaction = (values: TransactionValues) => {
		if (!addTransactionCurrencyId) {
			return;
		}
		addTransactionMutation.mutate({
			currencyId: addTransactionCurrencyId,
			...values,
		});
	};

	const handleEditTransaction = (values: TransactionValues) => {
		if (!editingTransaction) {
			return;
		}
		editTransactionMutation.mutate({
			id: editingTransaction.id,
			transactionTypeId: values.transactionTypeId,
			amount: values.amount,
			transactedAt: values.transactedAt,
			memo: values.memo ?? null,
		});
	};

	const handleDeleteTransaction = (id: string) => {
		deleteTransactionMutation.mutate(id);
	};

	const handleLoadMore = async () => {
		if (!(expandedCurrencyId && txCursor) || isLoadingMore) {
			return;
		}
		setIsLoadingMore(true);
		try {
			const result = await trpcClient.currencyTransaction.listByCurrency.query({
				currencyId: expandedCurrencyId,
				cursor: txCursor,
			});
			setAllTransactions((prev) => [...prev, ...result.items]);
			setTxCursor(result.nextCursor);
			setTxHasMore(result.nextCursor !== undefined);
		} finally {
			setIsLoadingMore(false);
		}
	};

	const toggleExpand = (id: string) => {
		setExpandedCurrencyId((prev) => {
			if (prev === id) {
				resetTransactionState();
				return null;
			}
			resetTransactionState();
			return id;
		});
	};

	const isSubmittingCreate = createMutation.isPending;
	const isSubmittingUpdate = updateMutation.isPending;
	const isSubmittingAddTransaction = addTransactionMutation.isPending;
	const isSubmittingEditTransaction = editTransactionMutation.isPending;

	return (
		<div className="p-4 md:p-6">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Currencies</h1>
				<Button onClick={() => setIsCreateOpen(true)}>
					<IconPlus size={16} />
					New Currency
				</Button>
			</div>

			{currencies.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
					<IconCoins size={48} />
					<p className="text-lg">No currencies yet</p>
					<p className="text-sm">
						Create your first currency to start tracking balances.
					</p>
					<Button onClick={() => setIsCreateOpen(true)} variant="outline">
						<IconPlus size={16} />
						New Currency
					</Button>
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{currencies.map((c) => (
						<CurrencyCard
							currency={c}
							expanded={expandedCurrencyId === c.id}
							hasMore={expandedCurrencyId === c.id ? txHasMore : false}
							isLoadingMore={
								expandedCurrencyId === c.id ? isLoadingMore : false
							}
							key={c.id}
							onAddTransaction={() => setAddTransactionCurrencyId(c.id)}
							onDelete={handleDelete}
							onDeleteTransaction={handleDeleteTransaction}
							onEdit={setEditingCurrency}
							onEditTransaction={setEditingTransaction}
							onLoadMore={handleLoadMore}
							onToggleExpand={() => toggleExpand(c.id)}
							transactions={expandedCurrencyId === c.id ? allTransactions : []}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={setIsCreateOpen}
				open={isCreateOpen}
				title="New Currency"
			>
				<CurrencyForm isLoading={isSubmittingCreate} onSubmit={handleCreate} />
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingCurrency(null);
					}
				}}
				open={editingCurrency !== null}
				title="Edit Currency"
			>
				{editingCurrency && (
					<CurrencyForm
						defaultValues={{
							name: editingCurrency.name,
							unit: editingCurrency.unit ?? undefined,
						}}
						isLoading={isSubmittingUpdate}
						onSubmit={handleUpdate}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setAddTransactionCurrencyId(null);
					}
				}}
				open={addTransactionCurrencyId !== null}
				title="Add Transaction"
			>
				<TransactionForm
					isLoading={isSubmittingAddTransaction}
					onSubmit={handleAddTransaction}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						setEditingTransaction(null);
					}
				}}
				open={editingTransaction !== null}
				title="Edit Transaction"
			>
				{editingTransaction && (
					<TransactionForm
						defaultValues={{
							amount: editingTransaction.amount,
							transactionTypeId: editingTransaction.transactionTypeId ?? "",
							transactedAt:
								typeof editingTransaction.transactedAt === "string"
									? editingTransaction.transactedAt
									: editingTransaction.transactedAt.toISOString(),
							memo: editingTransaction.memo ?? undefined,
						}}
						isLoading={isSubmittingEditTransaction}
						onSubmit={handleEditTransaction}
					/>
				)}
			</ResponsiveDialog>
		</div>
	);
}
