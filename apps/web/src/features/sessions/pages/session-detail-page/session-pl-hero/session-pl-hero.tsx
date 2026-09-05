import type { ReactNode } from "react";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";

interface SessionPlHeroProps {
	chart?: ReactNode;
	currencyUnit: string | null;
	evProfitLoss?: number | null;
	profitLoss: number | null;
}

export function SessionPlHero({
	chart,
	currencyUnit,
	evProfitLoss,
	profitLoss,
}: SessionPlHeroProps) {
	const pl = profitLoss ?? 0;
	return (
		<section
			aria-label="Profit and loss"
			className="mb-6 rounded-lg border border-border bg-card text-card-foreground"
		>
			<div className="px-4 py-6 text-center">
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
			</div>
			{chart ? <div className="border-border border-t p-4">{chart}</div> : null}
		</section>
	);
}
