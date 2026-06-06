import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";

interface SessionPlHeroProps {
	currencyUnit: string | null;
	/** EV-adjusted P&L (cash games with an EV cash-out); omitted otherwise. */
	evProfitLoss?: number | null;
	profitLoss: number | null;
}

/**
 * Headline P&L for the session detail page — the single number a player scans
 * for first. Colored by sign; an EV-adjusted figure sits beneath when present.
 */
export function SessionPlHero({
	currencyUnit,
	evProfitLoss,
	profitLoss,
}: SessionPlHeroProps) {
	const pl = profitLoss ?? 0;
	return (
		<section
			aria-label="Profit and loss"
			className="mb-6 rounded-lg border border-border bg-card px-4 py-6 text-center text-card-foreground"
		>
			<p className="t-meta text-muted-foreground">Profit / loss</p>
			<p
				className={`mt-1 font-mono font-semibold text-3xl tabular-nums ${profitLossColorClass(
					pl
				)}`}
			>
				{formatProfitLoss(pl, { currencyUnit })}
			</p>
			{evProfitLoss === null || evProfitLoss === undefined ? null : (
				<p className="mt-1 text-muted-foreground text-sm">
					EV{" "}
					<span className={profitLossColorClass(evProfitLoss)}>
						{formatProfitLoss(evProfitLoss, { currencyUnit })}
					</span>
				</p>
			)}
		</section>
	);
}
