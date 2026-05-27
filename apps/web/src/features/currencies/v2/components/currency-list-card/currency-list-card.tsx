import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { formatCompactNumber } from "@/utils/format-number";

interface CurrencyListCardProps {
	currency: {
		balance: number;
		id: string;
		name: string;
		unit?: string | null;
	};
}

export function CurrencyListCard({ currency: c }: CurrencyListCardProps) {
	return (
		<Link
			className="group/card flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
			params={{ currencyId: c.id }}
			to="/currencies/$currencyId"
		>
			<span className="min-w-0 flex-1 truncate font-medium text-base text-foreground">
				{c.name}
			</span>
			<span className="shrink-0 font-mono font-semibold text-base text-foreground tabular-nums">
				{formatCompactNumber(c.balance)}
				{c.unit ? (
					<span className="ml-1 font-medium text-muted-foreground text-sm">
						{c.unit}
					</span>
				) : null}
			</span>
			<IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5" />
		</Link>
	);
}
