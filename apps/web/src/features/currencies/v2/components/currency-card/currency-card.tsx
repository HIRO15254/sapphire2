import {
	IconChevronDown,
	IconEdit,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { TransactionListV2 } from "@/features/currencies/v2/components/transaction-list";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCompactNumber } from "@/utils/format-number";
import { useCurrencyCardV2 } from "./use-currency-card";

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

interface CurrencyCardV2Props {
	currency: {
		balance: number;
		id: string;
		name: string;
		unit?: string | null;
	};
	hasMore?: boolean;
	isExpanded: boolean;
	isLoadingMore?: boolean;
	onAddTransaction: () => void;
	onDelete: (id: string) => void;
	onDeleteTransaction: (id: string) => void;
	onEdit: (currency: {
		id: string;
		name: string;
		unit?: string | null;
	}) => void;
	onEditTransaction?: (transaction: Transaction) => void;
	onExpandChange: (isExpanded: boolean) => void;
	onLoadMore?: () => void;
	transactions: Transaction[];
}

export function CurrencyCardV2({
	currency: c,
	hasMore,
	isExpanded,
	isLoadingMore,
	onAddTransaction,
	onDelete,
	onDeleteTransaction,
	onEdit,
	onEditTransaction,
	onExpandChange,
	onLoadMore,
	transactions,
}: CurrencyCardV2Props) {
	const {
		confirmingDelete,
		handleCancelDelete,
		handleConfirmDelete,
		handleStartDelete,
		handleToggleExpanded,
	} = useCurrencyCardV2({ isExpanded, onExpandChange });

	return (
		<article className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
			<button
				aria-expanded={isExpanded}
				className={cn(
					"flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50",
					isExpanded && "bg-muted/30"
				)}
				onClick={handleToggleExpanded}
				type="button"
			>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<span className="truncate font-medium text-base text-foreground">
						{c.name}
					</span>
					{c.unit ? (
						<Badge
							className="shrink-0 font-mono text-[10px] uppercase"
							variant="outline"
						>
							{c.unit}
						</Badge>
					) : null}
				</div>
				<span className="shrink-0 font-mono font-semibold text-base text-foreground tabular-nums">
					{formatCompactNumber(c.balance)}
				</span>
				<IconChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						isExpanded && "rotate-180"
					)}
				/>
			</button>

			{isExpanded ? (
				<div className="border-border border-t">
					<div className="flex items-center justify-between border-border border-b px-3 py-2">
						<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Transactions
						</span>
						<Button
							onClick={onAddTransaction}
							size="xs"
							type="button"
							variant="outline"
						>
							<IconPlus />
							Add transaction
						</Button>
					</div>
					<div className="max-h-80 overflow-y-auto">
						<TransactionListV2
							hasMore={hasMore}
							isLoadingMore={isLoadingMore}
							onDelete={onDeleteTransaction}
							onEdit={onEditTransaction}
							onLoadMore={onLoadMore}
							transactions={transactions}
						/>
					</div>
					<div className="flex items-center justify-end gap-1 border-border border-t bg-muted/20 px-3 py-2">
						{confirmingDelete ? (
							<>
								<span className="mr-auto text-destructive text-xs">
									Delete this currency?
								</span>
								<Button
									aria-label="Confirm delete"
									className="text-destructive hover:text-destructive"
									onClick={() => handleConfirmDelete(() => onDelete(c.id))}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconTrash />
									Delete
								</Button>
								<Button
									aria-label="Cancel delete"
									onClick={handleCancelDelete}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconX />
									Cancel
								</Button>
							</>
						) : (
							<>
								<Button
									onClick={() => onEdit(c)}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconEdit />
									Edit
								</Button>
								<Button
									className="text-destructive hover:text-destructive"
									onClick={handleStartDelete}
									size="xs"
									type="button"
									variant="ghost"
								>
									<IconTrash />
									Delete
								</Button>
							</>
						)}
					</div>
				</div>
			) : null}
		</article>
	);
}
