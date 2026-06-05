import { IconCards, IconChevronRight, IconTrophy } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

interface StoreListCardProps {
	store: {
		id: string;
		memo?: string | null;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	};
}

export function StoreListCard({ store }: StoreListCardProps) {
	return (
		<Link
			className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ storeId: store.id }}
			to="/stores/$storeId"
		>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-foreground text-sm">
					{store.name}
				</p>
				{store.memo ? (
					<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
						{store.memo}
					</p>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs tabular-nums">
				<span
					aria-label="Cash games"
					className="flex items-center gap-1"
					role="img"
				>
					<IconCards aria-hidden className="size-3.5" />
					{store.ringGameCount}
				</span>
				<span
					aria-label="Tournaments"
					className="flex items-center gap-1"
					role="img"
				>
					<IconTrophy aria-hidden className="size-3.5" />
					{store.tournamentCount}
				</span>
			</div>
			<IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
