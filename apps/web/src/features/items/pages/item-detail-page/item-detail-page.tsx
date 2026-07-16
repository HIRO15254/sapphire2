import { IconPlus } from "@tabler/icons-react";
import { ItemFormV2 } from "@/features/items/components/item-form";
import { DeleteItemDialog } from "@/features/items/pages/item-detail-page/delete-item-dialog";
import { DeleteTransactionDialog } from "@/features/items/pages/item-detail-page/delete-transaction-dialog";
import { ItemActionsDrawer } from "@/features/items/pages/item-detail-page/item-actions-drawer";
import { TransactionActionsDrawer } from "@/features/items/pages/item-detail-page/transaction-actions-drawer";
import { TransactionFormV2 } from "@/features/items/pages/item-detail-page/transaction-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { QueryError } from "@/shared/components/query-error";
import { Button } from "@/shared/components/ui/button";
import { ItemDescription } from "./item-description";
import { ItemDetailSkeleton } from "./item-detail-skeleton";
import { ItemHoldingsHero } from "./item-holdings-hero";
import { TopBar } from "./top-bar";
import { TransactionListV2 } from "./transaction-list";
import { useItemDetailPage } from "./use-item-detail-page";

const EDIT_ITEM_FORM_ID = "item-edit-form";
const ADD_TRANSACTION_FORM_ID = "item-transaction-add-form";
const EDIT_TRANSACTION_FORM_ID = "item-transaction-edit-form";

interface ItemDetailPageProps {
	itemId: string;
}

export function ItemDetailPage({ itemId }: ItemDetailPageProps) {
	const {
		item,
		isLoading,
		isInitialLoadError,
		onRetry,
		transactions,
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
	} = useItemDetailPage(itemId);

	if (isLoading) {
		return (
			<div className="min-h-full bg-background text-foreground">
				<div className="p-4">
					<ItemDetailSkeleton />
				</div>
			</div>
		);
	}

	if (isInitialLoadError) {
		return (
			<div className="min-h-full bg-background text-foreground">
				<div className="p-4">
					<QueryError
						message="Unable to load item. Please try again."
						onRetry={onRetry}
					/>
				</div>
			</div>
		);
	}

	if (!item) {
		return (
			<div className="min-h-full bg-background text-foreground">
				<div className="p-4">
					<TopBar />
					<PageHeader heading="Item not found" />
					<p className="py-16 text-center text-muted-foreground text-sm">
						This item may have been deleted.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<TopBar onOpenActions={() => setIsActionsOpen(true)} />
				<PageHeader heading={item.name} />

				<ItemHoldingsHero
					currencyName={item.currencyName}
					currencyUnit={item.currencyUnit}
					holdings={item.holdings}
					unitValue={item.unitValue}
				/>

				{item.description ? <ItemDescription html={item.description} /> : null}

				<Button
					className="mb-6 w-full"
					onClick={() => setIsAddTransactionOpen(true)}
					size="lg"
				>
					<IconPlus className="size-5" />
					Add transaction
				</Button>

				<section className="rounded-lg border border-border bg-card text-card-foreground">
					<h2 className="t-h4 border-border border-b px-4 py-3">
						Transactions
					</h2>
					<TransactionListV2
						hasMore={hasNextPage}
						isError={isTransactionsInitialLoadError}
						isLoading={isTransactionsLoading}
						isLoadingMore={isFetchingNextPage}
						onLoadMore={fetchNextPage}
						onNavigateToSession={handleNavigateToSession}
						onOpenActions={openTransactionActions}
						onRetry={onRetryTransactions}
						transactions={transactions}
					/>
				</section>

				<ItemActionsDrawer
					onDelete={openDeleteFromActions}
					onEdit={openEditFromActions}
					onOpenChange={setIsActionsOpen}
					open={isActionsOpen}
				/>

				<TransactionActionsDrawer
					onClose={closeTransactionActions}
					onDelete={openDeleteFromTransactionActions}
					onEdit={openEditFromTransactionActions}
					open={transactionActionsTarget !== null}
				/>

				<FormSheet
					formId={EDIT_ITEM_FORM_ID}
					isLoading={isUpdatePending}
					onOpenChange={setIsEditOpen}
					open={isEditOpen}
					title="Edit item"
				>
					<ItemFormV2
						defaultValues={{
							name: item.name,
							currencyId: item.currencyId,
							unitValue: item.unitValue,
							description: item.description ?? null,
						}}
						formId={EDIT_ITEM_FORM_ID}
						onSubmit={handleEdit}
					/>
				</FormSheet>

				<FormSheet
					formId={ADD_TRANSACTION_FORM_ID}
					isLoading={isAddTransactionPending}
					onOpenChange={setIsAddTransactionOpen}
					open={isAddTransactionOpen}
					title="Add transaction"
				>
					<TransactionFormV2
						formId={ADD_TRANSACTION_FORM_ID}
						onSubmit={handleAddTransaction}
					/>
				</FormSheet>

				<FormSheet
					formId={EDIT_TRANSACTION_FORM_ID}
					isLoading={isEditTransactionPending}
					onOpenChange={(open) => {
						if (!open) {
							setEditingTransaction(null);
						}
					}}
					open={editingTransaction !== null}
					title="Edit transaction"
				>
					{editingTransaction && (
						<TransactionFormV2
							defaultValues={{
								count: editingTransaction.count,
								transactedAt:
									typeof editingTransaction.transactedAt === "string"
										? editingTransaction.transactedAt
										: editingTransaction.transactedAt.toISOString(),
								memo: editingTransaction.memo ?? undefined,
							}}
							formId={EDIT_TRANSACTION_FORM_ID}
							onSubmit={handleEditTransaction}
						/>
					)}
				</FormSheet>

				<DeleteItemDialog
					itemName={item.name}
					onConfirm={handleConfirmDelete}
					onOpenChange={setConfirmingDeleteItem}
					open={confirmingDeleteItem}
				/>

				<DeleteTransactionDialog
					onCancel={cancelDeleteTransaction}
					onConfirm={handleConfirmDeleteTransaction}
					open={pendingDeleteTransaction !== null}
				/>
			</div>
		</div>
	);
}
