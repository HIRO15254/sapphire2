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
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/shared/components/ui/badge";
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
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
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
		editingTransaction,
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
		handleDeleteTransaction,
		handleLoadMore,
		openEditFromActions,
		openDeleteFromActions,
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
				<PageHeader
					heading={
						<span className="flex items-center gap-2">
							<span className="truncate">{currency.name}</span>
							{currency.unit ? (
								<Badge
									className="shrink-0 font-mono uppercase"
									variant="outline"
								>
									{currency.unit}
								</Badge>
							) : null}
						</span>
					}
				/>

				<section className="mb-6 rounded-lg border border-border bg-card p-6 text-card-foreground">
					<p className="t-meta uppercase tracking-wide">Balance</p>
					<p className="t-h1 mt-1 font-mono tabular-nums">
						{formatCompactNumber(currency.balance)}
						{currency.unit ? (
							<span className="ml-2 font-medium font-sans text-muted-foreground text-sm">
								{currency.unit}
							</span>
						) : null}
					</p>
				</section>

				<section className="rounded-lg border border-border bg-card text-card-foreground">
					<div className="flex items-center justify-between border-border border-b px-4 py-3">
						<h2 className="t-h4">Transactions</h2>
						<Button
							onClick={() => setIsAddTransactionOpen(true)}
							size="sm"
							variant="outline"
						>
							<IconPlus size={16} />
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

				<Drawer onOpenChange={setIsActionsOpen} open={isActionsOpen}>
					<DrawerContent className="theme-v2 rounded-t-xl">
						{/* Drag handle — vaul handles the swipe-down dismiss when
						    `dismissible` is left at its default `true`. Overlay tap
						    also dismisses. */}
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
					dismissible={false}
					onOpenChange={setIsEditOpen}
					open={isEditOpen}
				>
					<DrawerContent className="theme-v2 rounded-t-xl">
						<DrawerHeader>
							<DrawerTitle>Edit currency</DrawerTitle>
							<DrawerDescription className="sr-only">
								Edit currency dialog
							</DrawerDescription>
						</DrawerHeader>
						<div className="overflow-y-auto px-4">
							<CurrencyFormV2
								defaultValues={{
									name: currency.name,
									unit: currency.unit ?? undefined,
								}}
								formId={EDIT_CURRENCY_FORM_ID}
								onSubmit={handleEdit}
							/>
						</div>
						<DrawerFooter className="flex-row justify-end pb-[calc(1rem+env(safe-area-inset-bottom))]">
							<Button
								onClick={() => setIsEditOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={isUpdatePending}
								form={EDIT_CURRENCY_FORM_ID}
								type="submit"
							>
								{isUpdatePending ? "Saving..." : "Save"}
							</Button>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>

				<Drawer
					dismissible={false}
					onOpenChange={setIsAddTransactionOpen}
					open={isAddTransactionOpen}
				>
					<DrawerContent className="theme-v2 rounded-t-xl">
						<DrawerHeader>
							<DrawerTitle>Add transaction</DrawerTitle>
							<DrawerDescription className="sr-only">
								Add transaction dialog
							</DrawerDescription>
						</DrawerHeader>
						<div className="overflow-y-auto px-4">
							<TransactionFormV2
								formId={ADD_TRANSACTION_FORM_ID}
								onSubmit={handleAddTransaction}
							/>
						</div>
						<DrawerFooter className="flex-row justify-end pb-[calc(1rem+env(safe-area-inset-bottom))]">
							<Button
								onClick={() => setIsAddTransactionOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={isAddTransactionPending}
								form={ADD_TRANSACTION_FORM_ID}
								type="submit"
							>
								{isAddTransactionPending ? "Saving..." : "Save"}
							</Button>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>

				<Drawer
					dismissible={false}
					onOpenChange={(open) => {
						if (!open) {
							setEditingTransaction(null);
						}
					}}
					open={editingTransaction !== null}
				>
					<DrawerContent className="theme-v2 rounded-t-xl">
						<DrawerHeader>
							<DrawerTitle>Edit transaction</DrawerTitle>
							<DrawerDescription className="sr-only">
								Edit transaction dialog
							</DrawerDescription>
						</DrawerHeader>
						<div className="overflow-y-auto px-4">
							{editingTransaction && (
								<TransactionFormV2
									defaultValues={{
										amount: editingTransaction.amount,
										transactionTypeId:
											editingTransaction.transactionTypeId ?? "",
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
						</div>
						<DrawerFooter className="flex-row justify-end pb-[calc(1rem+env(safe-area-inset-bottom))]">
							<Button
								onClick={() => setEditingTransaction(null)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button
								disabled={isEditTransactionPending}
								form={EDIT_TRANSACTION_FORM_ID}
								type="submit"
							>
								{isEditTransactionPending ? "Saving..." : "Save"}
							</Button>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>

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
			</div>
		</div>
	);
}
