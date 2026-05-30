import {
	IconChevronRight,
	IconStar,
	IconStarFilled,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { formatCompactNumber } from "@/utils/format-number";

interface CurrencyListCardProps {
	currency: {
		balance: number;
		id: string;
		isFavorite: boolean;
		name: string;
		unit?: string | null;
	};
	onToggleFavorite: () => void;
}

export function CurrencyListCard({
	currency: c,
	onToggleFavorite,
}: CurrencyListCardProps) {
	return (
		<Link
			className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ currencyId: c.id }}
			to="/currencies/$currencyId"
		>
			<button
				aria-label={c.isFavorite ? "Remove from favorites" : "Add to favorites"}
				className="shrink-0 rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
				onClick={(e) => {
					e.preventDefault();
					onToggleFavorite();
				}}
				type="button"
			>
				{c.isFavorite ? (
					<IconStarFilled className="size-4 text-yellow-500" />
				) : (
					<IconStar className="size-4" />
				)}
			</button>
			<span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
				{c.name}
			</span>
			<span className="shrink-0 font-mono font-semibold text-foreground text-sm tabular-nums">
				{formatCompactNumber(c.balance)}
				{c.unit ? (
					<span className="ml-1 font-medium text-muted-foreground text-xs">
						{c.unit}
					</span>
				) : null}
			</span>
			<IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
