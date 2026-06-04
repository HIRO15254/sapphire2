import { IconPlus, IconStar, IconStarFilled } from "@tabler/icons-react";
import { CurrencyBalanceHero } from "@/features/currencies/v2/components/currency-balance-hero";
import { CurrencyDescription } from "@/features/currencies/v2/components/currency-description";
import { CurrencyDetailSkeleton } from "@/features/currencies/v2/components/currency-detail-skeleton";
import { CurrencyFormV2 } from "@/features/currencies/v2/components/currency-form";
import { TransactionFormV2 } from "@/features/currencies/v2/components/transaction-form";
import { TransactionListV2 } from "@/features/currencies/v2/components/transaction-list";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { CurrencyActionsDrawer } from "./currency-actions-drawer";
import { DeleteCurrencyDialog } from "./delete-currency-dialog";
import { DeleteTransactionDialog } from "./delete-transaction-dialog";
import { TopBar } from "./top-bar";
import { TransactionActionsDrawer } from "./transaction-actions-drawer";
import { useCurrencyDetailPage } from "./use-currency-detail-page";

const EDIT_CURRENCY_FORM_ID = "currency-edit-form";
const ADD_TRANSACTION_FORM_ID = "transaction-add-form";
const EDIT_TRANSACTION_FORM_ID = "transaction-edit-form";

interface CurrencyDetailPageProps {
	currencyId: string;
}

export function CurrencyDetailPage({ currencyId }: CurrencyDetailPageProps) {
	const {
		currency,
		isLoading,
		transactions,
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
	} = useCurrencyDetailPage(currencyId);

	if (isLoading) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="p-4">
					<CurrencyDetailSkeleton />
				</div>
			</div>
		);
	}

	if (!currency) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="p-4">
					<TopBar />
					<PageHeader heading="Currency not found" />
					<p className="py-16 text-center text-muted-foreground text-sm">
						This currency may have been deleted.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<TopBar onOpenActions={() => setIsActionsOpen(true)} />
				<PageHeader
					heading={
						<span className="flex items-center gap-2">
							<button
								aria-label={
									currency.isFavorite
										? "Remove from favorites"
										: "Add to favorites"
								}
								className="-m-1.5 shrink-0 rounded p-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
								onClick={handleToggleFavorite}
								type="button"
							>
								{currency.isFavorite ? (
									<IconStarFilled className="size-5 text-yellow-500" />
								) : (
									<IconStar className="size-5" />
								)}
							</button>
							{currency.name}
						</span>
					}
				/>

				<CurrencyBalanceHero balance={currency.balance} unit={currency.unit} />

				{currency.description ? (
					<CurrencyDescription html={currency.description} />
				) : null}

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
						isLoading={isTransactionsLoading}
						isLoadingMore={isFetchingNextPage}
						onLoadMore={fetchNextPage}
						onOpenActions={openTransactionActions}
						transactions={transactions}
					/>
				</section>

				<CurrencyActionsDrawer
					isFavorite={currency.isFavorite}
					onDelete={openDeleteFromActions}
					onEdit={openEditFromActions}
					onOpenChange={setIsActionsOpen}
					onToggleFavorite={handleToggleFavorite}
					open={isActionsOpen}
				/>

				<TransactionActionsDrawer
					onClose={closeTransactionActions}
					onDelete={openDeleteFromTransactionActions}
					onEdit={openEditFromTransactionActions}
					open={transactionActionsTarget !== null}
				/>

				<FormSheet
					contentClassName="theme-v2"
					formId={EDIT_CURRENCY_FORM_ID}
					isLoading={isUpdatePending}
					onOpenChange={setIsEditOpen}
					open={isEditOpen}
					title="Edit currency"
				>
					<CurrencyFormV2
						defaultValues={{
							name: currency.name,
							unit: currency.unit ?? undefined,
							description: currency.description ?? null,
						}}
						formId={EDIT_CURRENCY_FORM_ID}
						onSubmit={handleEdit}
					/>
				</FormSheet>

				<FormSheet
					contentClassName="theme-v2"
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
					contentClassName="theme-v2"
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
								amount: editingTransaction.amount,
								transactionTypeId: editingTransaction.transactionTypeId ?? "",
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

				<DeleteCurrencyDialog
					currencyName={currency.name}
					onConfirm={handleConfirmDelete}
					onOpenChange={setConfirmingDeleteCurrency}
					open={confirmingDeleteCurrency}
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
