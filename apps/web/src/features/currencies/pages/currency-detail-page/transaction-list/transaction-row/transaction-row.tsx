import { IconChevronRight, IconDotsVertical } from "@tabler/icons-react";
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
	sessionName?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

const COMPACT_CELL = "px-3 py-1.5 align-middle";

interface TransactionRowProps {
	fmt: (n: number) => string;
	onNavigateToSession?: (sessionId: string) => void;
	onOpenActions?: (transaction: Transaction) => void;
	transaction: Transaction;
}

function ActionCell({
	isNavigable,
	isSessionGenerated,
	onNavigateToSession,
	onOpenActions,
	tx,
}: {
	isNavigable: boolean;
	isSessionGenerated: boolean;
	onNavigateToSession?: (sessionId: string) => void;
	onOpenActions?: (transaction: Transaction) => void;
	tx: Transaction;
}) {
	if (isNavigable && onNavigateToSession && tx.sessionId) {
		return (
			<span
				aria-hidden
				className="flex size-8 items-center justify-center text-muted-foreground"
			>
				<IconChevronRight className="size-4" />
			</span>
		);
	}
	if (isSessionGenerated || !onOpenActions) {
		return <span aria-hidden className="block size-8" />;
	}
	return (
		<Button
			aria-label="Transaction actions"
			onClick={() => onOpenActions(tx)}
			size="icon-sm"
			type="button"
			variant="ghost"
		>
			<IconDotsVertical className="size-4" />
		</Button>
	);
}

export function TransactionRow({
	fmt,
	onNavigateToSession,
	onOpenActions,
	transaction,
}: TransactionRowProps) {
	const tx = transaction;
	const amountClass = getAmountColorClass(tx.amount);
	const amountDisplay = getAmountDisplay(tx.amount, fmt);
	const isSessionGenerated = !!tx.sessionId;
	const isNavigable =
		isSessionGenerated && !!onNavigateToSession && !!tx.sessionId;

	const handleRowClick = isNavigable
		? () => {
				if (onNavigateToSession && tx.sessionId) {
					onNavigateToSession(tx.sessionId);
				}
			}
		: undefined;

	return (
		<TableRow
			className={
				isNavigable
					? "cursor-pointer hover:bg-muted/50"
					: "hover:bg-transparent"
			}
			onClick={handleRowClick}
		>
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
				{isSessionGenerated ? (tx.sessionName ?? "") : (tx.memo ?? "")}
			</TableCell>
			<TableCell
				className={`${COMPACT_CELL} w-px text-right font-mono font-semibold text-sm tabular-nums`}
			>
				<span className={amountClass}>{amountDisplay}</span>
			</TableCell>
			<TableCell className={`${COMPACT_CELL} w-px pl-0`}>
				<ActionCell
					isNavigable={isNavigable}
					isSessionGenerated={isSessionGenerated}
					onNavigateToSession={onNavigateToSession}
					onOpenActions={onOpenActions}
					tx={tx}
				/>
			</TableCell>
		</TableRow>
	);
}
