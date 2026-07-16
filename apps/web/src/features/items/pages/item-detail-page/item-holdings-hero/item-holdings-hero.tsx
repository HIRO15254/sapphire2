import {
	getHoldingsColorClass,
	getHoldingsDisplay,
} from "@/features/items/utils/holdings-format";
import { formatNumber } from "@/utils/format-number";

interface ItemHoldingsHeroProps {
	currencyName?: string | null;
	currencyUnit?: string | null;
	holdings: number;
	unitValue: number;
}

/** "Unit value 100 $ · USD" — the currency-equivalent value of one item. */
function buildUnitValueLine({
	currencyName,
	currencyUnit,
	unitValue,
}: Omit<ItemHoldingsHeroProps, "holdings">): string {
	const value = `${formatNumber(unitValue)}${currencyUnit ? ` ${currencyUnit}` : ""}`;
	return `Unit value ${value}${currencyName ? ` · ${currencyName}` : ""}`;
}

export function ItemHoldingsHero({
	currencyName,
	currencyUnit,
	holdings,
	unitValue,
}: ItemHoldingsHeroProps) {
	const { compact, exact } = getHoldingsDisplay(holdings);
	const colorClass = getHoldingsColorClass(holdings);

	return (
		<section
			aria-label="Holdings"
			className="mb-6 rounded-xl border border-border bg-card px-5 py-6 text-card-foreground"
		>
			<p className="t-meta uppercase tracking-wide">Holdings</p>
			<div className="mt-1 flex items-baseline gap-2">
				<span
					className={`font-mono font-semibold text-4xl tabular-nums ${colorClass}`}
				>
					{compact}
				</span>
			</div>
			{exact ? (
				<p className="mt-1 font-mono text-muted-foreground text-xs tabular-nums">
					{exact}
				</p>
			) : null}
			<p className="mt-2 text-muted-foreground text-sm">
				{buildUnitValueLine({ currencyName, currencyUnit, unitValue })}
			</p>
		</section>
	);
}
