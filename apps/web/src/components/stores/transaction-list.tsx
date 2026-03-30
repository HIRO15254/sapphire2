import { IconEdit, IconTrash } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	if (transactions.length === 0) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				No transactions yet.
			</p>
		);
	}

	const fmt = createGroupFormatter(transactions.map((tx) => tx.amount));

	return (
		<div className="flex flex-col divide-y">
			{transactions.map((tx) => {
				const isPositive = tx.amount >= 0;
				const amountClass = isPositive ? "text-green-600" : "text-red-600";
				const amountDisplay = isPositive
					? `+${fmt(tx.amount)}`
					: fmt(tx.amount);
				const txDate = new Date(tx.transactedAt);
				const dateDisplay = `${txDate.getFullYear()}/${String(txDate.getMonth() + 1).padStart(2, "0")}/${String(txDate.getDate()).padStart(2, "0")}`;
				const isSessionGenerated = !!tx.sessionId;

				return (
					<div
						className="flex items-center justify-between gap-1.5 py-1"
						key={tx.id}
					>
						<div className="flex flex-1 flex-col">
							<div className="flex items-center gap-1.5">
								<span className={`font-semibold text-sm ${amountClass}`}>
									{amountDisplay}
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
							<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
								<span>{dateDisplay}</span>
								{tx.memo && <span>· {tx.memo}</span>}
							</div>
						</div>
						<div className="flex items-center">
							{onEdit && !isSessionGenerated && (
								<Button
									aria-label="Edit transaction"
									onClick={() => onEdit(tx)}
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
									onClick={() => onDelete(tx.id)}
									size="icon-xs"
									variant="ghost"
								>
									<IconTrash size={13} />
								</Button>
							)}
						</div>
					</div>
				);
			})}
			{hasMore && (
				<div className="pt-2">
					<Button
						className="w-full"
						disabled={isLoadingMore}
						onClick={onLoadMore}
						size="sm"
						variant="outline"
					>
						{isLoadingMore ? "Loading..." : "Load more"}
					</Button>
				</div>
			)}
		</div>
	);
}
