import { IconCoins, IconPlus, IconTags } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { CurrencyCard } from "@/features/currencies/components/currency-card";
import { CurrencyForm } from "@/features/currencies/components/currency-form";
import { TransactionForm } from "@/features/currencies/components/transaction-form";
import { TransactionTypeManager } from "@/features/currencies/components/transaction-type-manager";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useCurrenciesPage } from "./-use-currencies-page";

export const Route = createFileRoute("/currencies/")({
	component: CurrenciesPage,
});

function CurrenciesPage() {
	const {
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
	} = useCurrenciesPage();

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
				<CurrencyForm isLoading={isCreatePending} onSubmit={handleCreate} />
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
