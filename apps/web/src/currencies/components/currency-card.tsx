import { IconPlus } from "@tabler/icons-react";
import { TransactionList } from "@/currencies/components/transaction-list";
import { EntityListItem } from "@/shared/components/management/entity-list-item";
import { ManagementSectionHeader } from "@/shared/components/management/management-section-header";
import { Button } from "@/shared/components/ui/button";
import { formatCompactNumber } from "@/utils/format-number";

function getExpandedValue(
	isExpanded: boolean | undefined
): "details" | null | undefined {
	if (isExpanded === undefined) {
		return undefined;
	}
	return isExpanded ? "details" : null;
}

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
	hasMore?: boolean;
	isExpanded?: boolean;
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
	onExpandChange?: (isExpanded: boolean) => void;
	onLoadMore?: () => void;
	transactions: Transaction[];
}

export function CurrencyCard({
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
}: CurrencyCardProps) {
	const expandedValue = getExpandedValue(isExpanded);

	return (
		<EntityListItem
			deleteLabel="currency"
			expandedValue={expandedValue}
			onDelete={() => onDelete(c.id)}
			onEdit={() => onEdit(c)}
			onExpandedValueChange={(value) => onExpandChange?.(value !== null)}
			summary={
				<div className="flex w-full items-center justify-between gap-2 text-left">
					<span className="truncate font-medium text-sm">{c.name}</span>
					<span className="shrink-0 font-semibold text-foreground text-sm">
						{formatCompactNumber(c.balance)}
						{c.unit ? ` ${c.unit}` : ""}
					</span>
				</div>
			}
		>
			<ManagementSectionHeader
				action={
					<Button onClick={onAddTransaction} size="sm" variant="outline">
						<IconPlus size={14} />
						Add
					</Button>
				}
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
		</EntityListItem>
	);
}
