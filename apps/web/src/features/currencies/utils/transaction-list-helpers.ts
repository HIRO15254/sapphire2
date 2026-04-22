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
