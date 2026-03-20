import { IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

interface TransactionListProps {
	hasMore?: boolean;
	isLoadingMore?: boolean;
	onDelete: (id: string) => void;
	onLoadMore?: () => void;
	transactions: Transaction[];
}

export function TransactionList({
	transactions,
	onDelete,
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

	return (
		<div className="flex flex-col divide-y">
			{transactions.map((tx) => {
				const isPositive = tx.amount >= 0;
				const amountClass = isPositive ? "text-green-600" : "text-red-600";
				const amountDisplay = isPositive
					? `+${tx.amount.toLocaleString()}`
					: tx.amount.toLocaleString();
				const dateDisplay = new Date(tx.transactedAt).toLocaleDateString(
					"en-US",
					{ year: "numeric", month: "short", day: "numeric" }
				);

				return (
					<div
						className="flex items-center justify-between gap-2 py-2"
						key={tx.id}
					>
						<div className="flex flex-1 flex-col gap-0.5">
							<div className="flex items-center gap-2">
								<span className={`font-semibold ${amountClass}`}>
									{amountDisplay}
								</span>
								<span className="text-muted-foreground text-xs">
									{tx.transactionTypeName}
								</span>
							</div>
							<div className="flex items-center gap-2 text-muted-foreground text-xs">
								<span>{dateDisplay}</span>
								{tx.memo && <span>· {tx.memo}</span>}
							</div>
						</div>
						<Button
							aria-label="Delete transaction"
							className="text-destructive hover:text-destructive"
							onClick={() => onDelete(tx.id)}
							size="sm"
							variant="ghost"
						>
							<IconTrash size={14} />
						</Button>
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
