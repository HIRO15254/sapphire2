import { IconDotsVertical, IconReceipt } from "@tabler/icons-react";
import { Fragment } from "react";
import {
	buildGroupFormatter,
	getAmountColorClass,
	getAmountDisplay,
	groupTransactionsByDate,
} from "@/features/currencies/utils/transaction-list-helpers";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
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
	/** Initial transactions fetch is in flight (no rows yet). */
	isLoading?: boolean;
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

const COMPACT_CELL = "px-3 py-1.5 align-middle";
const COLUMN_COUNT = 4;

interface TransactionRowProps {
	fmt: (n: number) => string;
	onOpenActions?: (transaction: Transaction) => void;
	transaction: Transaction;
}

function TransactionRow({
	fmt,
	onOpenActions,
	transaction,
}: TransactionRowProps) {
	const tx = transaction;
	const amountClass = getAmountColorClass(tx.amount);
	const amountDisplay = getAmountDisplay(tx.amount, fmt);
	const isSessionGenerated = !!tx.sessionId;

	return (
		<TableRow className="hover:bg-transparent">
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
}

export function TransactionListV2({
	transactions,
	onOpenActions,
	hasMore,
	isLoading,
	isLoadingMore,
	onLoadMore,
}: TransactionListV2Props) {
	const fmt = buildGroupFormatter(transactions);
	const groups = groupTransactionsByDate(transactions);

	if (isLoading && transactions.length === 0) {
		return (
			<div
				className="flex flex-col gap-3 p-4"
				data-testid="transaction-list-skeleton"
			>
				{Array.from({ length: 4 }, (_, i) => i).map((i) => (
					<div className="flex items-center gap-3" key={i}>
						<Skeleton className="h-4 w-16 shrink-0" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-4 w-14 shrink-0" />
					</div>
				))}
			</div>
		);
	}

	if (transactions.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-muted-foreground">
				<IconReceipt className="size-7 opacity-60" />
				<p className="text-sm">No transactions yet</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<Table>
				<TableBody>
					{groups.map((group) => (
						<Fragment key={group.key}>
							<TableRow className="border-0 hover:bg-transparent">
								<TableCell
									className="bg-muted/40 px-3 py-1.5 font-medium text-muted-foreground text-xs tabular-nums"
									colSpan={COLUMN_COUNT}
								>
									{group.label}
								</TableCell>
							</TableRow>
							{group.items.map((tx) => (
								<TransactionRow
									fmt={fmt}
									key={tx.id}
									onOpenActions={onOpenActions}
									transaction={tx}
								/>
							))}
						</Fragment>
					))}
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
