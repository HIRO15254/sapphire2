import { createGroupFormatter, formatYmdSlash } from "@/utils/format-number";

export interface TransactionDisplayItem {
	count: number;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	transactedAt: Date | string;
}

export function buildGroupFormatter(transactions: TransactionDisplayItem[]) {
	return createGroupFormatter(transactions.map((tx) => tx.count));
}

/**
 * Signed-count color. A transaction count is a delta on the holdings ledger,
 * so a gain (`>= 0`) reads as `success` and a spend as `destructive` — the
 * semantic tokens used across the item surface. (Contrast with *holdings*, a
 * stock, where only negatives are flagged — see `getHoldingsColorClass`.)
 */
export function getCountColorClass(count: number): string {
	return count >= 0 ? "text-success" : "text-destructive";
}

export function getCountDisplay(
	count: number,
	fmt: (n: number) => string
): string {
	return count >= 0 ? `+${fmt(count)}` : fmt(count);
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
