import { formatCompactNumber } from "@/utils/format-number";

export interface BalanceDisplay {
	/** Compact, abbreviated form (e.g. "10k", "-100k", "1,234"). */
	compact: string;
	/**
	 * Full, grouped form (e.g. "10,000") shown as a secondary line — but only
	 * when the compact form actually abbreviated the value. `null` when the
	 * compact form already shows every digit, so the hero never prints the
	 * same number twice.
	 */
	exact: string | null;
}

export function getBalanceDisplay(balance: number): BalanceDisplay {
	const compact = formatCompactNumber(balance);
	const exact = balance.toLocaleString();
	return { compact, exact: compact === exact ? null : exact };
}

/**
 * Hero balance color. A balance is a holding, not a P/L, so positives stay
 * neutral (avoids greening every account); only a negative balance (a deficit)
 * is flagged with the v2 destructive token used across the currency surface.
 */
export function getBalanceColorClass(balance: number): string {
	return balance < 0 ? "text-destructive" : "";
}
