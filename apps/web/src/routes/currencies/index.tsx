import { IconCoins, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
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
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
	const [txCursor, setTxCursor] = useState<string | undefined>(undefined);
	const [txHasMore, setTxHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const transactionsQuery = useQuery(
		trpc.currencyTransaction.listByCurrency.queryOptions(
			{ currencyId: expandedCurrencyId ?? "" },
			{ enabled: expandedCurrencyId !== null }
		)
	);

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

	const handleCreate = async (values: CurrencyValues) => {
		setIsSubmitting(true);
		try {
			await trpcClient.currency.create.mutate(values);
			await currenciesQuery.refetch();
			setIsCreateOpen(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdate = async (values: CurrencyValues) => {
		if (!editingCurrency) {
			return;
		}
		setIsSubmitting(true);
		try {
			await trpcClient.currency.update.mutate({
				id: editingCurrency.id,
				...values,
			});
			await currenciesQuery.refetch();
			setEditingCurrency(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		await trpcClient.currency.delete.mutate({ id });
		await currenciesQuery.refetch();
		if (expandedCurrencyId === id) {
			setExpandedCurrencyId(null);
			resetTransactionState();
		}
	};

	const handleAddTransaction = async (values: TransactionValues) => {
		if (!addTransactionCurrencyId) {
			return;
		}
		setIsSubmitting(true);
		try {
			await trpcClient.currencyTransaction.create.mutate({
				currencyId: addTransactionCurrencyId,
				...values,
			});
			await currenciesQuery.refetch();
			resetTransactionState();
			await transactionsQuery.refetch();
			setAddTransactionCurrencyId(null);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteTransaction = async (id: string) => {
		await trpcClient.currencyTransaction.delete.mutate({ id });
		await currenciesQuery.refetch();
		resetTransactionState();
		await transactionsQuery.refetch();
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
				<CurrencyForm isLoading={isSubmitting} onSubmit={handleCreate} />
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
						isLoading={isSubmitting}
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
					isLoading={isSubmitting}
					onSubmit={handleAddTransaction}
				/>
			</ResponsiveDialog>
		</div>
	);
}
