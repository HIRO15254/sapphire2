import {
	IconChevronDown,
	IconEdit,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useTransactionListV2 } from "./use-transaction-list";

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

interface TransactionListV2Props {
	hasMore?: boolean;
	isLoadingMore?: boolean;
	onDelete: (id: string) => void;
	onEdit?: (transaction: Transaction) => void;
	onLoadMore?: () => void;
	transactions: Transaction[];
}

export function TransactionListV2({
	transactions,
	onDelete,
	onEdit,
	hasMore,
	isLoadingMore,
	onLoadMore,
}: TransactionListV2Props) {
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
	} = useTransactionListV2(transactions);

	if (transactions.length === 0) {
		return (
			<p className="px-3 py-6 text-center text-muted-foreground text-sm">
				No transactions yet
			</p>
		);
	}

	return (
		<div className="flex flex-col">
			<ul className="divide-y divide-border">
				{transactions.map((tx) => {
					const amountClass = getAmountClass(tx.amount);
					const amountDisplay = getAmountDisplay(tx.amount);
					const dateDisplay = getDateDisplay(tx.transactedAt);
					const isSessionGenerated = !!tx.sessionId;
					const isExpanded = expandedId === tx.id;
					const isConfirmingDelete = confirmingDeleteId === tx.id;

					if (isSessionGenerated) {
						return (
							<li
								className="flex items-center gap-3 px-3 py-3 text-sm"
								key={tx.id}
							>
								<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
									{dateDisplay}
								</span>
								<Badge className="shrink-0 text-[10px]" variant="secondary">
									Session
								</Badge>
								<span className="ml-auto shrink-0 font-mono font-semibold text-sm tabular-nums">
									<span className={amountClass}>{amountDisplay}</span>
								</span>
							</li>
						);
					}

					return (
						<li key={tx.id}>
							<button
								aria-expanded={isExpanded}
								className={cn(
									"flex w-full items-center gap-3 px-3 py-3 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
									isExpanded && "bg-muted/40"
								)}
								onClick={() => (isExpanded ? onCollapse() : onExpand(tx.id))}
								type="button"
							>
								<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
									{dateDisplay}
								</span>
								<Badge className="shrink-0 text-[10px]" variant="outline">
									{tx.transactionTypeName}
								</Badge>
								{tx.memo ? (
									<span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
										{tx.memo}
									</span>
								) : (
									<span className="flex-1" />
								)}
								<span className="shrink-0 font-mono font-semibold text-sm tabular-nums">
									<span className={amountClass}>{amountDisplay}</span>
								</span>
								<IconChevronDown
									className={cn(
										"size-3.5 shrink-0 text-muted-foreground transition-transform",
										isExpanded && "rotate-180"
									)}
								/>
							</button>
							{isExpanded ? (
								<div className="border-border border-t bg-muted/20 px-3 py-2">
									{tx.memo ? (
										<p className="mb-2 whitespace-pre-wrap text-foreground text-xs">
											{tx.memo}
										</p>
									) : null}
									{isConfirmingDelete ? (
										<div className="flex items-center justify-end gap-1">
											<span className="mr-auto text-destructive text-xs">
												Delete this transaction?
											</span>
											<Button
												aria-label="Confirm delete"
												className="text-destructive hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation();
													onDelete(tx.id);
													onConfirmDeleteCancel();
													onCollapse();
												}}
												size="xs"
												type="button"
												variant="ghost"
											>
												<IconTrash />
												Delete
											</Button>
											<Button
												aria-label="Cancel delete"
												onClick={(e) => {
													e.stopPropagation();
													onConfirmDeleteCancel();
												}}
												size="xs"
												type="button"
												variant="ghost"
											>
												<IconX />
												Cancel
											</Button>
										</div>
									) : (
										<div className="flex items-center justify-end gap-1">
											{onEdit ? (
												<Button
													aria-label="Edit transaction"
													onClick={(e) => {
														e.stopPropagation();
														onEdit(tx);
													}}
													size="xs"
													type="button"
													variant="ghost"
												>
													<IconEdit />
													Edit
												</Button>
											) : null}
											<Button
												aria-label="Delete transaction"
												className="text-destructive hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation();
													onConfirmDelete(tx.id);
												}}
												size="xs"
												type="button"
												variant="ghost"
											>
												<IconTrash />
												Delete
											</Button>
										</div>
									)}
								</div>
							) : null}
						</li>
					);
				})}
			</ul>
			{hasMore ? (
				<div className="border-border border-t p-2">
					<Button
						className="w-full"
						disabled={isLoadingMore}
						onClick={onLoadMore}
						size="sm"
						variant="ghost"
					>
						{isLoadingMore ? "Loading..." : "Load more"}
					</Button>
				</div>
			) : null}
		</div>
	);
}
