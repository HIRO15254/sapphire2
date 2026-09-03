import { formatCompactNumber, formatNumber } from "@/utils/format-number";

export interface BalanceDisplay {
	compact: string;
	exact: string | null;
}

export function getBalanceDisplay(balance: number): BalanceDisplay {
	const compact = formatCompactNumber(balance);
	const exact = formatNumber(balance);
	return { compact, exact: compact === exact ? null : exact };
}

export function getBalanceColorClass(balance: number): string {
	return balance < 0 ? "text-destructive" : "";
}
