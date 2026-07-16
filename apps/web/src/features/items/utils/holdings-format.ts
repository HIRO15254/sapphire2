import { formatCompactNumber, formatNumber } from "@/utils/format-number";

export interface HoldingsDisplay {
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

export function getHoldingsDisplay(holdings: number): HoldingsDisplay {
	const compact = formatCompactNumber(holdings);
	const exact = formatNumber(holdings);
	return { compact, exact: compact === exact ? null : exact };
}

/**
 * Hero holdings color. Holdings are a stock, not a P/L, so positives stay
 * neutral; only negative holdings (spent more than gained — a ledger anomaly)
 * are flagged with the destructive token used across the item surface.
 */
export function getHoldingsColorClass(holdings: number): string {
	return holdings < 0 ? "text-destructive" : "";
}
