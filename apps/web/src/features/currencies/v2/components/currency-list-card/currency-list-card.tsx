import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/shared/components/ui/badge";
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
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<span className="truncate font-medium text-base text-foreground">
					{c.name}
				</span>
				{c.unit ? (
					<Badge
						className="shrink-0 font-mono text-[10px] uppercase"
						variant="outline"
					>
						{c.unit}
					</Badge>
				) : null}
			</div>
			<span className="shrink-0 font-mono font-semibold text-base text-foreground tabular-nums">
				{formatCompactNumber(c.balance)}
			</span>
			<IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5" />
		</Link>
	);
}
