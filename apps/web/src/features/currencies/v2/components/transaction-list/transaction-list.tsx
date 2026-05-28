import { IconDotsVertical } from "@tabler/icons-react";
import {
	buildGroupFormatter,
	getAmountDisplay,
	getDateDisplay,
} from "@/features/currencies/utils/transaction-list-helpers";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

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
	onLoadMore?: () => void;
	/**
	 * Called when the trailing 3-dots overflow button is tapped on a
	 * non-session row. The page opens an action sheet (Edit / Delete)
	 * scoped to the supplied transaction. Session-generated rows are
	 * read-only and never expose this affordance.
	 */
	onOpenActions?: (transaction: Transaction) => void;
	transactions: Transaction[];
}

function getAmountClassV2(amount: number): string {
	return amount >= 0 ? "text-[hsl(var(--success))]" : "text-destructive";
}

export function TransactionListV2({
	transactions,
	onOpenActions,
	hasMore,
	isLoadingMore,
	onLoadMore,
}: TransactionListV2Props) {
	const fmt = buildGroupFormatter(transactions);

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
					const amountClass = getAmountClassV2(tx.amount);
					const amountDisplay = getAmountDisplay(tx.amount, fmt);
					const dateDisplay = getDateDisplay(tx.transactedAt);
					const isSessionGenerated = !!tx.sessionId;

					return (
						<li
							className="flex items-center gap-3 px-3 py-3 text-sm"
							key={tx.id}
						>
							<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
								{dateDisplay}
							</span>
							{isSessionGenerated ? (
								<Badge className="shrink-0 text-[10px]" variant="secondary">
									Session
								</Badge>
							) : (
								<Badge className="shrink-0 text-[10px]" variant="outline">
									{tx.transactionTypeName}
								</Badge>
							)}
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
							{isSessionGenerated || !onOpenActions ? null : (
								<Button
									aria-label="Transaction actions"
									className="-mr-1.5 shrink-0"
									onClick={() => onOpenActions(tx)}
									size="icon-sm"
									type="button"
									variant="ghost"
								>
									<IconDotsVertical className="size-4" />
								</Button>
							)}
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
