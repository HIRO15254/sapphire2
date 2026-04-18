import { IconCoins, IconPlus, IconTags } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CurrencyCard } from "@/currencies/components/currency-card";
import { CurrencyForm } from "@/currencies/components/currency-form";
import { TransactionForm } from "@/currencies/components/transaction-form";
import { TransactionTypeManager } from "@/currencies/components/transaction-type-manager";
import type {
	CurrencyItem,
	CurrencyValues,
	Transaction,
	TransactionValues,
} from "@/currencies/hooks/use-currencies";
import { useCurrencies } from "@/currencies/hooks/use-currencies";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

export const Route = createFileRoute("/currencies/")({
	component: CurrenciesPage,
});

function CurrenciesPage() {
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

	return (
		<div className="p-4 md:p-6">
			<PageHeader
				actions={
					<>
						<Button
							onClick={() => setIsTypeManagerOpen(true)}
							size="sm"
							variant="outline"
						>
							<IconTags size={16} />
							Manage Types
						</Button>
						<Button onClick={() => setIsCreateOpen(true)}>
							<IconPlus size={16} />
							New Currency
						</Button>
					</>
				}
				heading="Currencies"
			/>

			{currencies.length === 0 ? (
				<EmptyState
					action={
						<Button onClick={() => setIsCreateOpen(true)} variant="outline">
							<IconPlus size={16} />
							New Currency
						</Button>
					}
					description="Create your first currency to start tracking balances."
					heading="No currencies yet"
					icon={<IconCoins size={48} />}
				/>
			) : (
				<div className="flex flex-col gap-2">
					{currencies.map((c) => (
						<CurrencyCard
							currency={c}
							hasMore={expandedCurrencyId === c.id ? txHasMore : false}
							isExpanded={expandedCurrencyId === c.id}
							isLoadingMore={
								expandedCurrencyId === c.id ? isLoadingMore : false
							}
							key={c.id}
							onAddTransaction={() => setAddTransactionCurrencyId(c.id)}
							onDelete={handleDelete}
							onDeleteTransaction={handleDeleteTransaction}
							onEdit={setEditingCurrency}
							onEditTransaction={setEditingTransaction}
							onExpandChange={(expanded) => {
								handleExpandedCurrencyChange(expanded ? c.id : null);
							}}
							onLoadMore={handleLoadMore}
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
				<CurrencyForm
					isLoading={isCreatePending}
					onCancel={() => setIsCreateOpen(false)}
					onSubmit={handleCreate}
				/>
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
						isLoading={isUpdatePending}
						onCancel={() => setEditingCurrency(null)}
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
					isLoading={isAddTransactionPending}
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
						isLoading={isEditTransactionPending}
						onSubmit={handleEditTransaction}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={setIsTypeManagerOpen}
				open={isTypeManagerOpen}
				title="Manage Types"
			>
				<TransactionTypeManager />
			</ResponsiveDialog>
		</div>
	);
}
