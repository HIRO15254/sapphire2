import { createGroupFormatter, formatYmdSlash } from "@/utils/format-number";

export interface TransactionDisplayItem {
	amount: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	transactedAt: Date | string;
	transactionTypeName: string;
}

export function buildGroupFormatter(transactions: TransactionDisplayItem[]) {
	return createGroupFormatter(transactions.map((tx) => tx.amount));
}

export function getAmountClass(amount: number): string {
	return amount >= 0 ? "text-green-600" : "text-red-600";
}

export function getAmountDisplay(
	amount: number,
	fmt: (n: number) => string
): string {
	return amount >= 0 ? `+${fmt(amount)}` : fmt(amount);
}

export function getDateDisplay(transactedAt: Date | string): string {
	return formatYmdSlash(new Date(transactedAt));
}

export interface TransactionDateGroup {
	items: TransactionDisplayItem[];
	key: string;
	label: string;
}

/**
 * Collapse a date-sorted transaction list into per-day groups so the table can
 * show one date sub-header instead of repeating the date on every row. Input
 * order is preserved and only *consecutive* same-day rows are merged (the list
 * arrives sorted by `transactedAt` desc), so a date that re-appears later in
 * the list yields a separate group.
 */
export function groupTransactionsByDate(
	transactions: TransactionDisplayItem[]
): TransactionDateGroup[] {
	const groups: TransactionDateGroup[] = [];
	for (const tx of transactions) {
		const label = getDateDisplay(tx.transactedAt);
		const last = groups.at(-1);
		if (last && last.label === label) {
			last.items.push(tx);
		} else {
			groups.push({ key: `${label}-${groups.length}`, label, items: [tx] });
		}
	}
	return groups;
}
