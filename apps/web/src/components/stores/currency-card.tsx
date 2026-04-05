import { IconEdit, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { ExpandableItem } from "@/components/management/expandable-item-list";
import { ManagementSectionHeader } from "@/components/management/management-section-header";
import { TransactionList } from "@/components/stores/transaction-list";
import { Button } from "@/components/ui/button";
import { formatCompactNumber } from "@/utils/format-number";

interface Transaction {
	amount: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
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
	transactions,
}: CurrencyCardProps) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (!expanded) {
			setConfirmingDelete(false);
		}
	}, [expanded]);

	return (
		<ExpandableItem
			contentClassName="pb-2 pl-2"
			summary={
				<div className="min-w-0 flex-1">
					<div className="flex items-center justify-between gap-2 pr-1">
						<span className="truncate font-medium text-sm">{c.name}</span>
						<span className="shrink-0 font-semibold text-foreground text-sm">
							{formatCompactNumber(c.balance)}
							{c.unit ? ` ${c.unit}` : ""}
						</span>
					</div>
					<p className="mt-0.5 text-muted-foreground text-xs">Balance</p>
				</div>
			}
			value={c.id}
		>
			<ManagementSectionHeader
				action={
					<Button onClick={onAddTransaction} size="sm" variant="outline">
						<IconPlus size={14} />
						Add
					</Button>
				}
				className="mb-2"
				heading="Transaction History"
			/>

			<div className="max-h-80 overflow-y-auto">
				<TransactionList
					hasMore={hasMore}
					isLoadingMore={isLoadingMore}
					onDelete={onDeleteTransaction}
					onEdit={onEditTransaction}
					onLoadMore={onLoadMore}
					transactions={transactions}
				/>
			</div>

			{confirmingDelete ? (
				<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
					<span className="text-[10px] text-destructive">Delete?</span>
					<Button
						aria-label="Confirm delete"
						className="text-destructive hover:text-destructive"
						onClick={() => {
							onDelete(c.id);
							setConfirmingDelete(false);
						}}
						size="icon-xs"
						variant="ghost"
					>
						<IconTrash size={12} />
					</Button>
					<Button
						aria-label="Cancel delete"
						onClick={() => setConfirmingDelete(false)}
						size="icon-xs"
						variant="ghost"
					>
						<IconX size={12} />
					</Button>
				</div>
			) : (
				<div className="mt-2 flex items-center justify-end gap-1 border-t pt-2">
					<Button
						aria-label="Edit currency"
						onClick={() => onEdit(c)}
						size="icon-xs"
						variant="ghost"
					>
						<IconEdit size={12} />
					</Button>
					<Button
						aria-label="Delete currency"
						className="text-destructive hover:text-destructive"
						onClick={() => setConfirmingDelete(true)}
						size="icon-xs"
						variant="ghost"
					>
						<IconTrash size={12} />
					</Button>
				</div>
			)}
		</ExpandableItem>
	);
}
