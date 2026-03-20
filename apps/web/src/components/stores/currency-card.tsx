import {
	IconChevronDown,
	IconChevronUp,
	IconEdit,
	IconPlus,
	IconTrash,
	IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { TransactionList } from "@/components/stores/transaction-list";
import { Button } from "@/components/ui/button";

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

interface CurrencyCardProps {
	currency: {
		balance: number;
		id: string;
		name: string;
		unit?: string | null;
	};
	expanded: boolean;
	hasMore?: boolean;
	isLoadingMore?: boolean;
	onAddTransaction: () => void;
	onDelete: (id: string) => void;
	onDeleteTransaction: (id: string) => void;
	onEdit: (currency: {
		id: string;
		name: string;
		unit?: string | null;
	}) => void;
	onLoadMore?: () => void;
	onToggleExpand: () => void;
	transactions: Transaction[];
}

export function CurrencyCard({
	currency: c,
	expanded,
	hasMore,
	isLoadingMore,
	onAddTransaction,
	onDelete,
	onDeleteTransaction,
	onEdit,
	onLoadMore,
	onToggleExpand,
	transactions,
}: CurrencyCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-center gap-2 p-3">
				<button
					className="flex flex-1 items-center gap-2 text-left"
					onClick={onToggleExpand}
					type="button"
				>
					<div className="flex-1">
						<p className="font-medium">{c.name}</p>
						<p className="text-muted-foreground text-sm">
							Balance:{" "}
							<span className="font-semibold text-foreground">
								{c.balance.toLocaleString()}
								{c.unit ? ` ${c.unit}` : ""}
							</span>
						</p>
					</div>
					{expanded ? (
						<IconChevronUp className="text-muted-foreground" size={16} />
					) : (
						<IconChevronDown className="text-muted-foreground" size={16} />
					)}
				</button>

				<div className="flex items-center gap-1">
					{confirmingDelete ? (
						<>
							<span className="text-destructive text-xs">Delete?</span>
							<Button
								aria-label="Confirm delete currency"
								className="text-destructive hover:text-destructive"
								onClick={() => {
									onDelete(c.id);
									setConfirmingDelete(false);
								}}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={14} />
							</Button>
							<Button
								aria-label="Cancel delete"
								onClick={() => setConfirmingDelete(false)}
								size="sm"
								variant="ghost"
							>
								<IconX size={14} />
							</Button>
						</>
					) : (
						<>
							<Button
								aria-label="Edit currency"
								onClick={() => onEdit(c)}
								size="sm"
								variant="ghost"
							>
								<IconEdit size={14} />
							</Button>
							<Button
								aria-label="Delete currency"
								onClick={() => setConfirmingDelete(true)}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={14} />
							</Button>
						</>
					)}
				</div>
			</div>

			{expanded && (
				<div className="border-t px-3 pb-3">
					<div className="mt-3 mb-2 flex items-center justify-between">
						<span className="font-medium text-sm">Transaction History</span>
						<Button onClick={onAddTransaction} size="sm" variant="outline">
							<IconPlus size={14} />
							Add
						</Button>
					</div>
					<TransactionList
						hasMore={hasMore}
						isLoadingMore={isLoadingMore}
						onDelete={onDeleteTransaction}
						onLoadMore={onLoadMore}
						transactions={transactions}
					/>
				</div>
			)}
		</div>
	);
}
