import { IconPlus } from "@tabler/icons-react";
import { TransactionList } from "@/components/stores/transaction-list";
import { Button } from "@/components/ui/button";
import { ExpandableCard } from "@/components/ui/expandable-card";
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
	return (
		<ExpandableCard
			collapseOnDelete={false}
			deleteLabel="currency"
			expanded={expanded}
			header={
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
			}
			onDelete={() => onDelete(c.id)}
			onEdit={() => onEdit(c)}
			onExpandedChange={() => onToggleExpand()}
		>
			<div className="mt-2 mb-1 flex items-center justify-between">
				<span className="font-medium text-sm">Transaction History</span>
				<Button
					onClick={(e) => {
						e.stopPropagation();
						onAddTransaction();
					}}
					size="sm"
					variant="outline"
				>
					<IconPlus size={14} />
					Add
				</Button>
			</div>
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
		</ExpandableCard>
	);
}
