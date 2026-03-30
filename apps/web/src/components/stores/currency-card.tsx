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
import { formatCompactNumber } from "@/utils/format-number";

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
	onEditTransaction?: (transaction: Transaction) => void;
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
	onEditTransaction,
	onLoadMore,
	onToggleExpand,
	transactions,
}: CurrencyCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	return (
		<div className="rounded-lg border bg-card">
			<div className="flex items-start gap-2 p-3">
				<div className="min-w-0 flex-1">
					<span className="font-medium text-sm">{c.name}</span>
					<p className="text-muted-foreground text-sm">
						Balance:{" "}
						<span className="font-semibold text-foreground">
							{formatCompactNumber(c.balance)}
							{c.unit ? ` ${c.unit}` : ""}
						</span>
					</p>
				</div>

				<Button
					aria-label={expanded ? "Collapse details" : "Expand details"}
					className="shrink-0 text-muted-foreground"
					onClick={() => {
						onToggleExpand();
						setConfirmingDelete(false);
					}}
					size="icon-xs"
					variant="ghost"
				>
					{expanded ? (
						<IconChevronUp size={16} />
					) : (
						<IconChevronDown size={16} />
					)}
				</Button>
			</div>

			<div
				className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
			>
				<div className="overflow-hidden">
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
							onEdit={onEditTransaction}
							onLoadMore={onLoadMore}
							transactions={transactions}
						/>

						{confirmingDelete ? (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<span className="text-destructive text-xs">
									Delete this currency?
								</span>
								<Button
									aria-label="Confirm delete"
									className="text-destructive hover:text-destructive"
									onClick={() => {
										onDelete(c.id);
										setConfirmingDelete(false);
									}}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
								<Button
									aria-label="Cancel delete"
									onClick={() => setConfirmingDelete(false)}
									size="xs"
									variant="ghost"
								>
									<IconX size={14} />
									Cancel
								</Button>
							</div>
						) : (
							<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
								<Button onClick={() => onEdit(c)} size="xs" variant="ghost">
									<IconEdit size={14} />
									Edit
								</Button>
								<Button
									className="text-destructive hover:text-destructive"
									onClick={() => setConfirmingDelete(true)}
									size="xs"
									variant="ghost"
								>
									<IconTrash size={14} />
									Delete
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
