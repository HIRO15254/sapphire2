import { formatCompactNumber } from "@/utils/format-number";

interface FormatProfitLossOptions {
	currencyUnit?: string | null;
	nullDisplay?: string;
}

export function formatProfitLoss(
	value: number | null | undefined,
	options?: FormatProfitLossOptions
): string {
	if (value === null || value === undefined) {
		return options?.nullDisplay ?? "—";
	}
	const sign = value >= 0 ? "+" : "";
	const body = formatCompactNumber(value);
	return options?.currencyUnit
		? `${sign}${body} ${options.currencyUnit}`
		: `${sign}${body}`;
}

export function profitLossColorClass(value: number | null | undefined): string {
	if (value === null || value === undefined || value === 0) {
		return "";
	}
	return value > 0
		? "text-green-600 dark:text-green-400"
		: "text-red-600 dark:text-red-400";
}
