import { IconDotsVertical } from "@tabler/icons-react";
import {
	getAmountColorClass,
	getAmountDisplay,
} from "@/features/currencies/utils/transaction-list-helpers";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { TableCell, TableRow } from "@/shared/components/ui/table";

export interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

const COMPACT_CELL = "px-3 py-1.5 align-middle";

interface TransactionRowProps {
	fmt: (n: number) => string;
	onOpenActions?: (transaction: Transaction) => void;
	transaction: Transaction;
}

export function TransactionRow({
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
