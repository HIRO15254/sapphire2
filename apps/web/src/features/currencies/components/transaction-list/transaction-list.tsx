import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import {
	ExpandableItem,
	ExpandableItemList,
} from "@/shared/components/management/expandable-item-list";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useTransactionList } from "./use-transaction-list";

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

interface TransactionListProps {
	hasMore?: boolean;
	isLoadingMore?: boolean;
	onDelete: (id: string) => void;
	onEdit?: (transaction: Transaction) => void;
	onLoadMore?: () => void;
	transactions: Transaction[];
}

export function TransactionList({
	transactions,
	onDelete,
	onEdit,
	hasMore,
	isLoadingMore,
	onLoadMore,
}: TransactionListProps) {
	const {
		confirmingDeleteId,
		expandedId,
		getAmountClass,
		getAmountDisplay,
		getDateDisplay,
		onCollapse,
		onConfirmDelete,
		onConfirmDeleteCancel,
		onExpand,
	} = useTransactionList(transactions);

	if (transactions.length === 0) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				No transactions yet.
			</p>
		);
	}

	return (
		<div className="flex flex-col">
			<div className="divide-y">
				{transactions.map((tx) => {
					const amountClass = getAmountClass(tx.amount);
					const amountDisplay = getAmountDisplay(tx.amount);
					const dateDisplay = getDateDisplay(tx.transactedAt);
					const isSessionGenerated = !!tx.sessionId;
					const isConfirmingDelete = confirmingDeleteId === tx.id;

					if (isSessionGenerated) {
						return (
							<div
								className="flex items-center justify-between gap-2 py-2 pr-8 text-left"
								key={tx.id}
							>
								<div className="flex items-center gap-1.5">
									<span className="text-muted-foreground text-xs">
										{dateDisplay}
									</span>
									<Badge className="text-[10px]" variant="secondary">
										Session
									</Badge>
								</div>
								<span
									className={`shrink-0 font-semibold text-sm ${amountClass}`}
								>
									{amountDisplay}
								</span>
							</div>
						);
					}

					return (
						<ExpandableItemList
							key={tx.id}
							onValueChange={(id) => {
								if (id) {
									onExpand(id);
								} else {
									onCollapse();
								}
							}}
							value={expandedId === tx.id ? tx.id : null}
						>
							<ExpandableItem
								contentClassName="pb-1.5"
								summary={
									<div className="flex w-full items-center justify-between gap-2 pr-1 text-left">
										<div className="flex items-center gap-1.5">
											<span className="text-muted-foreground text-xs">
												{dateDisplay}
											</span>
											<Badge className="text-[10px]" variant="outline">
												{tx.transactionTypeName}
											</Badge>
										</div>
										<span
											className={`shrink-0 font-semibold text-sm ${amountClass}`}
										>
											{amountDisplay}
										</span>
									</div>
								}
								value={tx.id}
							>
								<div className="pb-1.5">
									{tx.memo && (
										<p className="mb-1 text-muted-foreground text-xs">
											{tx.memo}
										</p>
									)}
									{isConfirmingDelete ? (
										<div className="flex items-center justify-end gap-1">
											<span className="text-destructive text-xs">Delete?</span>
											<Button
												aria-label="Confirm delete"
												className="text-destructive hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation();
													onDelete(tx.id);
													onConfirmDeleteCancel();
													onCollapse();
												}}
												size="icon-xs"
												variant="ghost"
											>
												<IconTrash size={13} />
											</Button>
											<Button
												aria-label="Cancel delete"
												onClick={(e) => {
													e.stopPropagation();
													onConfirmDeleteCancel();
												}}
												size="icon-xs"
												variant="ghost"
											>
												<IconX size={13} />
											</Button>
										</div>
									) : (
										<div className="flex items-center justify-end gap-0.5">
											{onEdit && (
												<Button
													aria-label="Edit transaction"
													onClick={(e) => {
														e.stopPropagation();
														onEdit(tx);
													}}
													size="icon-xs"
													variant="ghost"
												>
													<IconEdit size={13} />
												</Button>
											)}
											<Button
												aria-label="Delete transaction"
												className="text-destructive hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation();
													onConfirmDelete(tx.id);
												}}
												size="icon-xs"
												variant="ghost"
											>
												<IconTrash size={13} />
											</Button>
										</div>
									)}
								</div>
							</ExpandableItem>
						</ExpandableItemList>
					);
				})}
			</div>
			<div className="pt-2">
				{hasMore && (
					<Button
						className="w-full"
						disabled={isLoadingMore}
						onClick={onLoadMore}
						size="sm"
						variant="outline"
					>
						{isLoadingMore ? "Loading..." : "Load more"}
					</Button>
				)}
			</div>
		</div>
	);
}
