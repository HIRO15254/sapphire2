import { IconEdit, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import {
	ExpandableItem,
	ExpandableItemList,
} from "@/shared/components/management/expandable-item-list";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { createGroupFormatter } from "@/utils/format-number";

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
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	if (transactions.length === 0) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				No transactions yet.
			</p>
		);
	}

	const fmt = createGroupFormatter(transactions.map((tx) => tx.amount));

	return (
		<div className="flex flex-col">
			<ExpandableItemList
				onValueChange={(id) => {
					setExpandedId(id);
					setConfirmingDeleteId(null);
				}}
				value={expandedId}
			>
				{transactions.map((tx) => {
					const isPositive = tx.amount >= 0;
					const amountClass = isPositive ? "text-green-600" : "text-red-600";
					const amountDisplay = isPositive
						? `+${fmt(tx.amount)}`
						: fmt(tx.amount);
					const txDate = new Date(tx.transactedAt);
					const dateDisplay = `${txDate.getFullYear()}/${String(txDate.getMonth() + 1).padStart(2, "0")}/${String(txDate.getDate()).padStart(2, "0")}`;
					const isSessionGenerated = !!tx.sessionId;
					const isConfirmingDelete = confirmingDeleteId === tx.id;

					return (
						<ExpandableItem
							contentClassName="pb-1.5"
							key={tx.id}
							summary={
								<div className="flex w-full items-center justify-between gap-2 pr-1 text-left">
									<div className="flex items-center gap-1.5">
										<span className="text-muted-foreground text-xs">
											{dateDisplay}
										</span>
										<Badge className="text-[10px]" variant="outline">
											{tx.transactionTypeName}
										</Badge>
										{isSessionGenerated && (
											<Badge className="text-[10px]" variant="secondary">
												Session
											</Badge>
										)}
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
												setConfirmingDeleteId(null);
												setExpandedId(null);
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
												setConfirmingDeleteId(null);
											}}
											size="icon-xs"
											variant="ghost"
										>
											<IconX size={13} />
										</Button>
									</div>
								) : (
									<div className="flex items-center justify-end gap-0.5">
										{onEdit && !isSessionGenerated && (
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
										{!isSessionGenerated && (
											<Button
												aria-label="Delete transaction"
												className="text-destructive hover:text-destructive"
												onClick={(e) => {
													e.stopPropagation();
													setConfirmingDeleteId(tx.id);
												}}
												size="icon-xs"
												variant="ghost"
											>
												<IconTrash size={13} />
											</Button>
										)}
									</div>
								)}
							</div>
						</ExpandableItem>
					);
				})}
			</ExpandableItemList>
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
