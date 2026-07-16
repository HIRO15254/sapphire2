import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { formatCompactNumber } from "@/utils/format-number";

interface ItemListCardProps {
	item: {
		currencyName?: string | null;
		currencyUnit?: string | null;
		holdings: number;
		id: string;
		name: string;
		unitValue: number;
	};
}

/** "100 $ · USD" — unit value (+ unit) with the owning currency's name. */
function buildMetaLine(item: ItemListCardProps["item"]): string {
	const unitValue = `${formatCompactNumber(item.unitValue)}${
		item.currencyUnit ? ` ${item.currencyUnit}` : ""
	}`;
	return item.currencyName ? `${unitValue} · ${item.currencyName}` : unitValue;
}

export function ItemListCard({ item }: ItemListCardProps) {
	return (
		<div className="rounded-lg border border-border bg-card px-4 py-3 text-card-foreground transition-colors hover:bg-muted/50">
			<Link
				className="flex min-w-0 items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				params={{ itemId: item.id }}
				to="/items/$itemId"
			>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate font-medium text-foreground text-sm">
						{item.name}
					</span>
					<span className="truncate text-muted-foreground text-xs">
						{buildMetaLine(item)}
					</span>
				</span>
				<span className="shrink-0 font-mono font-semibold text-foreground text-sm tabular-nums">
					{formatCompactNumber(item.holdings)}
					<span className="ml-1 font-medium font-sans text-muted-foreground text-xs">
						held
					</span>
				</span>
				<IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
			</Link>
		</div>
	);
}
