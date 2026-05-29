import {
	IconArrowLeft,
	IconDotsVertical,
	IconEdit,
	IconPlus,
	IconTrash,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CurrencyFormV2 } from "@/features/currencies/v2/components/currency-form";
import { TransactionFormV2 } from "@/features/currencies/v2/components/transaction-form";
import { TransactionListV2 } from "@/features/currencies/v2/components/transaction-list";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { RichTextContent } from "@/shared/components/ui/rich-text-content";
import { formatCompactNumber } from "@/utils/format-number";
import { useCurrencyDetailPage } from "./-use-currency-detail-page";

export const Route = createFileRoute("/currencies/$currencyId")({
	component: CurrencyDetailPage,
});

const EDIT_CURRENCY_FORM_ID = "currency-edit-form";
const ADD_TRANSACTION_FORM_ID = "transaction-add-form";
const EDIT_TRANSACTION_FORM_ID = "transaction-edit-form";

interface TopBarProps {
	onOpenActions?: () => void;
}

function TopBar({ onOpenActions }: TopBarProps) {
	return (
		<div className="mb-2 flex items-center justify-between">
			<Button asChild className="-ml-2" size="sm" variant="ghost">
				<Link to="/currencies">
					<IconArrowLeft size={18} />
					Back
				</Link>
			</Button>
			{onOpenActions ? (
				<Button
					aria-label="More actions"
					className="-mr-2"
					onClick={onOpenActions}
					size="icon-lg"
					variant="ghost"
				>
					<IconDotsVertical size={20} />
				</Button>
			) : null}
		</div>
	);
}

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
		handleLoadMore,
		openEditFromActions,
		openDeleteFromActions,
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
				<PageHeader heading={currency.name} />

				<section
					aria-label="Balance"
					className="mb-6 flex items-baseline justify-center gap-2 py-3"
				>
					<p className="font-mono font-semibold text-3xl text-foreground tabular-nums">
						{formatCompactNumber(currency.balance)}
					</p>
					{currency.unit ? (
						<span className="t-meta uppercase tracking-wide">
							{currency.unit}
						</span>
					) : null}
				</section>

				{currency.description ? (
					<section className="mb-6 rounded-lg border border-border bg-card text-card-foreground">
						<h2 className="t-h4 border-border border-b px-4 py-3">
							Description
						</h2>
						<RichTextContent
							className="px-4 py-3 text-sm"
							html={currency.description}
						/>
					</section>
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
						hasMore={txHasMore}
						isLoadingMore={isLoadingMore}
						onLoadMore={handleLoadMore}
						onOpenActions={openTransactionActions}
						transactions={transactions}
					/>
				</section>

				<Drawer onOpenChange={setIsActionsOpen} open={isActionsOpen}>
					<DrawerContent className="theme-v2 rounded-t-xl">
						<div
							aria-hidden
							className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
						/>
						<DrawerTitle className="sr-only">Currency actions</DrawerTitle>
						<DrawerDescription className="sr-only">
							Edit or delete this currency.
						</DrawerDescription>
						<ul className="flex flex-col gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
							<li>
								<button
									className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-foreground text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
									onClick={openEditFromActions}
									type="button"
								>
									<IconEdit size={18} />
									Edit currency
								</button>
							</li>
							<li>
								<button
									className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-destructive text-sm outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/40"
									onClick={openDeleteFromActions}
									type="button"
								>
									<IconTrash size={18} />
									Delete currency
								</button>
							</li>
						</ul>
					</DrawerContent>
				</Drawer>

				<Drawer
					onOpenChange={(open) => {
						if (!open) {
							closeTransactionActions();
						}
					}}
					open={transactionActionsTarget !== null}
				>
					<DrawerContent className="theme-v2 rounded-t-xl">
						<div
							aria-hidden
							className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
						/>
						<DrawerTitle className="sr-only">Transaction actions</DrawerTitle>
						<DrawerDescription className="sr-only">
							Edit or delete this transaction.
						</DrawerDescription>
						<ul className="flex flex-col gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
							<li>
								<button
									className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-foreground text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
									onClick={openEditFromTransactionActions}
									type="button"
								>
									<IconEdit size={18} />
									Edit transaction
								</button>
							</li>
							<li>
								<button
									className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-destructive text-sm outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/40"
									onClick={openDeleteFromTransactionActions}
									type="button"
								>
									<IconTrash size={18} />
									Delete transaction
								</button>
							</li>
						</ul>
					</DrawerContent>
				</Drawer>

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

				<Dialog
					onOpenChange={setConfirmingDeleteCurrency}
					open={confirmingDeleteCurrency}
				>
					<DialogContent className="theme-v2">
						<DialogHeader>
							<DialogTitle>Delete this currency?</DialogTitle>
							<DialogDescription>
								{currency.name} and all of its transactions will be removed
								permanently. This cannot be undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="flex-row justify-end gap-2">
							<Button
								onClick={() => setConfirmingDeleteCurrency(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								onClick={handleConfirmDelete}
								type="button"
								variant="destructive"
							>
								Delete
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<Dialog
					onOpenChange={(open) => {
						if (!open) {
							cancelDeleteTransaction();
						}
					}}
					open={pendingDeleteTransaction !== null}
				>
					<DialogContent className="theme-v2">
						<DialogHeader>
							<DialogTitle>Delete this transaction?</DialogTitle>
							<DialogDescription>
								This transaction will be removed permanently. This cannot be
								undone.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="flex-row justify-end gap-2">
							<Button
								onClick={cancelDeleteTransaction}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								onClick={handleConfirmDeleteTransaction}
								type="button"
								variant="destructive"
							>
								Delete
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
