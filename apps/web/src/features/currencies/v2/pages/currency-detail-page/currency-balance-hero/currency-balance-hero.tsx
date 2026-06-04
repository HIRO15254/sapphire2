import {
	getBalanceColorClass,
	getBalanceDisplay,
} from "@/features/currencies/utils/balance-format";

interface CurrencyBalanceHeroProps {
	balance: number;
	unit?: string | null;
}

export function CurrencyBalanceHero({
	balance,
	unit,
}: CurrencyBalanceHeroProps) {
	const { compact, exact } = getBalanceDisplay(balance);
	const colorClass = getBalanceColorClass(balance);

	return (
		<section
			aria-label="Balance"
			className="mb-6 rounded-xl border border-border bg-card px-5 py-6 text-card-foreground"
		>
			<p className="t-meta uppercase tracking-wide">Balance</p>
			<div className="mt-1 flex items-baseline gap-2">
				<span
					className={`font-mono font-semibold text-4xl tabular-nums ${colorClass}`}
				>
					{compact}
				</span>
				{unit ? (
					<span className="font-medium text-base text-muted-foreground">
						{unit}
					</span>
				) : null}
			</div>
			{exact ? (
				<p className="mt-1 font-mono text-muted-foreground text-xs tabular-nums">
					{exact}
					{unit ? ` ${unit}` : ""}
				</p>
			) : null}
		</section>
	);
}
