import { IconChevronRight, IconDotsVertical } from "@tabler/icons-react";
import type { KeyboardEvent } from "react";
import {
	getCountColorClass,
	getCountDisplay,
} from "@/features/items/utils/transaction-list-helpers";
import type { ItemTransaction } from "@/features/items/utils/types";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { TableCell, TableRow } from "@/shared/components/ui/table";

const COMPACT_CELL = "px-3 py-1.5 align-middle";

interface TransactionRowProps {
	fmt: (n: number) => string;
	onNavigateToSession?: (sessionId: string) => void;
	onOpenActions?: (transaction: ItemTransaction) => void;
	transaction: ItemTransaction;
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
	onOpenActions?: (transaction: ItemTransaction) => void;
	tx: ItemTransaction;
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
	const countClass = getCountColorClass(tx.count);
	const countDisplay = getCountDisplay(tx.count, fmt);
	const isSessionGenerated = !!tx.sessionId;
	const isNavigable = isSessionGenerated && !!onNavigateToSession;

	const navigateToSession = () => {
		if (onNavigateToSession && tx.sessionId) {
			onNavigateToSession(tx.sessionId);
		}
	};

	const handleRowClick = isNavigable ? navigateToSession : undefined;

	const handleRowKeyDown = isNavigable
		? (event: KeyboardEvent<HTMLTableRowElement>) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					navigateToSession();
				}
			}
		: undefined;

	return (
		<TableRow
			aria-label={
				isNavigable
					? `View session${tx.sessionName ? ` ${tx.sessionName}` : ""}`
					: undefined
			}
			className={
				isNavigable
					? "cursor-pointer hover:bg-muted/50"
					: "hover:bg-transparent"
			}
			onClick={handleRowClick}
			onKeyDown={handleRowKeyDown}
			role={isNavigable ? "button" : undefined}
			tabIndex={isNavigable ? 0 : undefined}
		>
			<TableCell className={`${COMPACT_CELL} w-px`}>
				{isSessionGenerated ? (
					<Badge className="shrink-0 text-[10px]" variant="secondary">
						Session
					</Badge>
				) : (
					<Badge className="shrink-0 text-[10px]" variant="outline">
						Manual
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
				<span className={countClass}>{countDisplay}</span>
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
