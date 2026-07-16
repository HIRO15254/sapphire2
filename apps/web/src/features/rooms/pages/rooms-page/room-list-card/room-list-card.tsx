import {
	IconChevronRight,
	IconPokerChip,
	IconStar,
	IconStarFilled,
	IconTrophy,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

interface RoomListCardProps {
	onToggleFavorite: () => void;
	room: {
		id: string;
		isFavorite: boolean;
		memo?: string | null;
		name: string;
		ringGameCount: number;
		tournamentCount: number;
	};
}

export function RoomListCard({ room, onToggleFavorite }: RoomListCardProps) {
	return (
		<div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground transition-colors hover:bg-muted/50">
			<button
				aria-label={
					room.isFavorite ? "Remove from favorites" : "Add to favorites"
				}
				className="-m-1.5 shrink-0 rounded p-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
				onClick={(e) => {
					e.preventDefault();
					onToggleFavorite();
				}}
				type="button"
			>
				{room.isFavorite ? (
					<IconStarFilled className="size-4 text-yellow-500" />
				) : (
					<IconStar className="size-4" />
				)}
			</button>
			<Link
				className="flex min-w-0 flex-1 items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				params={{ roomId: room.id }}
				to="/rooms/$roomId"
			>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-foreground text-sm">
						{room.name}
					</p>
					{room.memo ? (
						<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
							{room.memo}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs tabular-nums">
					<span
						aria-label="Cash games"
						className="flex items-center gap-1"
						role="img"
					>
						<IconPokerChip aria-hidden className="size-3.5" />
						{room.ringGameCount}
					</span>
					<span
						aria-label="Tournaments"
						className="flex items-center gap-1"
						role="img"
					>
						<IconTrophy aria-hidden className="size-3.5" />
						{room.tournamentCount}
					</span>
				</div>
				<IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
			</Link>
		</div>
	);
}
