import {
	IconArrowLeft,
	IconEdit,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CurrencyFormV2 } from "@/features/currencies/v2/components/currency-form";
import { TransactionFormV2 } from "@/features/currencies/v2/components/transaction-form";
import { TransactionListV2 } from "@/features/currencies/v2/components/transaction-list";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { formatCompactNumber } from "@/utils/format-number";
import { useCurrencyDetailPage } from "./-use-currency-detail-page";

export const Route = createFileRoute("/currencies/$currencyId")({
	component: CurrencyDetailPage,
});

const EDIT_CURRENCY_FORM_ID = "currency-edit-form";
const ADD_TRANSACTION_FORM_ID = "transaction-add-form";
const EDIT_TRANSACTION_FORM_ID = "transaction-edit-form";

function CurrencyDetailPage() {
	const { currencyId } = Route.useParams();
	const {
		currency,
		isLoading,
		transactions,
		txHasMore,
		isLoadingMore,
		isUpdatePending,
		isAddTransactionPending,
		isEditTransactionPending,
		isEditOpen,
		isAddTransactionOpen,
		editingTransaction,
		confirmingDeleteCurrency,
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
	} = useCurrencyDetailPage(currencyId);

	if (isLoading) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="mx-auto max-w-3xl p-4 md:p-6">
					<p className="py-16 text-center text-muted-foreground text-sm">
						Loading currency...
					</p>
				</div>
			</div>
		);
	}

	if (!currency) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="mx-auto max-w-3xl p-4 md:p-6">
					<PageHeader
						actions={
							<Button asChild size="sm" variant="ghost">
								<Link to="/currencies">
									<IconArrowLeft size={16} />
									Back
								</Link>
							</Button>
						}
						heading="Currency not found"
					/>
					<p className="py-16 text-center text-muted-foreground text-sm">
						This currency may have been deleted.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="mx-auto max-w-3xl p-4 md:p-6">
				<PageHeader
					actions={
						<Button asChild size="sm" variant="ghost">
							<Link to="/currencies">
								<IconArrowLeft size={16} />
								Back
							</Link>
						</Button>
					}
					heading={
						<span className="flex items-center gap-2">
							<span className="truncate">{currency.name}</span>
							{currency.unit ? (
								<Badge
									className="shrink-0 font-mono text-[10px] uppercase"
									variant="outline"
								>
									{currency.unit}
								</Badge>
							) : null}
						</span>
					}
				/>

				<section className="mb-6 rounded-lg border border-border bg-card p-6 text-card-foreground">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Balance
					</p>
					<p className="mt-1 font-mono font-semibold text-3xl text-foreground tabular-nums">
						{formatCompactNumber(currency.balance)}
						{currency.unit ? (
							<span className="ml-2 font-medium text-base text-muted-foreground">
								{currency.unit}
							</span>
						) : null}
					</p>
				</section>

				<section className="rounded-lg border border-border bg-card text-card-foreground">
					<div className="flex items-center justify-between border-border border-b px-4 py-3">
						<h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Transactions
						</h2>
						<Button
							onClick={() => setIsAddTransactionOpen(true)}
							size="sm"
							variant="outline"
						>
							<IconPlus size={14} />
							Add transaction
						</Button>
					</div>
					<TransactionListV2
						hasMore={txHasMore}
						isLoadingMore={isLoadingMore}
						onDelete={handleDeleteTransaction}
						onEdit={setEditingTransaction}
						onLoadMore={handleLoadMore}
						transactions={transactions}
					/>
				</section>

				<div className="mt-6 flex items-center justify-end gap-2">
					<Button
						onClick={() => setIsEditOpen(true)}
						size="sm"
						variant="outline"
					>
						<IconEdit size={14} />
						Edit currency
					</Button>
					<Button
						className="text-destructive hover:text-destructive"
						onClick={() => setConfirmingDeleteCurrency(true)}
						size="sm"
						variant="ghost"
					>
						<IconTrash size={14} />
						Delete currency
					</Button>
				</div>

				<ResponsiveDialog
					contentClassName="theme-v2"
					onOpenChange={setIsEditOpen}
					open={isEditOpen}
					primaryAction={{
						form: EDIT_CURRENCY_FORM_ID,
						isLoading: isUpdatePending,
						label: "Save",
					}}
					title="Edit currency"
				>
					<CurrencyFormV2
						defaultValues={{
							name: currency.name,
							unit: currency.unit ?? undefined,
						}}
						formId={EDIT_CURRENCY_FORM_ID}
						onSubmit={handleEdit}
					/>
				</ResponsiveDialog>

				<ResponsiveDialog
					contentClassName="theme-v2"
					onOpenChange={setIsAddTransactionOpen}
					open={isAddTransactionOpen}
					primaryAction={{
						form: ADD_TRANSACTION_FORM_ID,
						isLoading: isAddTransactionPending,
						label: "Save",
					}}
					title="Add transaction"
				>
					<TransactionFormV2
						formId={ADD_TRANSACTION_FORM_ID}
						onSubmit={handleAddTransaction}
					/>
				</ResponsiveDialog>

				<ResponsiveDialog
					contentClassName="theme-v2"
					onOpenChange={(open) => {
						if (!open) {
							setEditingTransaction(null);
						}
					}}
					open={editingTransaction !== null}
					primaryAction={{
						form: EDIT_TRANSACTION_FORM_ID,
						isLoading: isEditTransactionPending,
						label: "Save",
					}}
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
				</ResponsiveDialog>

				<ResponsiveDialog
					contentClassName="theme-v2"
					onOpenChange={setConfirmingDeleteCurrency}
					open={confirmingDeleteCurrency}
					primaryAction={{
						label: "Delete",
						onClick: handleConfirmDelete,
					}}
					title="Delete this currency?"
				>
					<p className="text-sm">
						{currency.name} and all of its transactions will be removed
						permanently. This cannot be undone.
					</p>
				</ResponsiveDialog>
			</div>
		</div>
	);
}
