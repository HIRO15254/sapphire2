import { IconDotsVertical } from "@tabler/icons-react";
import {
	buildGroupFormatter,
	getAmountDisplay,
	getDateDisplay,
} from "@/features/currencies/utils/transaction-list-helpers";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableRow,
} from "@/shared/components/ui/table";

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
	 * read-only — the actions cell is still reserved on those rows so
	 * the amount column stays aligned.
	 */
	onOpenActions?: (transaction: Transaction) => void;
	transactions: Transaction[];
}

function getAmountClassV2(amount: number): string {
	return amount >= 0 ? "text-success" : "text-destructive";
}

const COMPACT_CELL = "px-3 py-1.5 align-middle";

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
			<Table>
				<TableBody>
					{transactions.map((tx) => {
						const amountClass = getAmountClassV2(tx.amount);
						const amountDisplay = getAmountDisplay(tx.amount, fmt);
						const dateDisplay = getDateDisplay(tx.transactedAt);
						const isSessionGenerated = !!tx.sessionId;
						return (
							<TableRow className="hover:bg-transparent" key={tx.id}>
								<TableCell
									className={`${COMPACT_CELL} w-px text-muted-foreground text-xs tabular-nums`}
								>
									{dateDisplay}
								</TableCell>
								<TableCell className={`${COMPACT_CELL} w-px`}>
									{isSessionGenerated ? (
										<Badge className="shrink-0 text-[10px]" variant="secondary">
											Session
										</Badge>
									) : (
										<Badge className="shrink-0 text-[10px]" variant="outline">
											{tx.transactionTypeName}
										</Badge>
									)}
								</TableCell>
								<TableCell
									className={`${COMPACT_CELL} max-w-0 truncate text-muted-foreground text-xs`}
								>
									{tx.memo ?? ""}
								</TableCell>
								<TableCell
									className={`${COMPACT_CELL} w-px text-right font-mono font-semibold text-sm tabular-nums`}
								>
									<span className={amountClass}>{amountDisplay}</span>
								</TableCell>
								<TableCell className={`${COMPACT_CELL} w-px pl-0`}>
									{isSessionGenerated || !onOpenActions ? (
										<span aria-hidden className="block size-8" />
									) : (
										<Button
											aria-label="Transaction actions"
											onClick={() => onOpenActions(tx)}
											size="icon-sm"
											type="button"
											variant="ghost"
										>
											<IconDotsVertical className="size-4" />
										</Button>
									)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
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
