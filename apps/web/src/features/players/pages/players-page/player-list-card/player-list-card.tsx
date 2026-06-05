import { IconChevronRight, IconNote } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { ColorBadge } from "@/features/players/components/color-badge";

interface PlayerListCardProps {
	player: {
		id: string;
		memo?: string | null;
		name: string;
		tags: Array<{ color: string; id: string; name: string }>;
	};
}

/**
 * Fixed-height list row so every card is the same size regardless of whether
 * the player has tags or a memo. The name sits on line 1, tags on a reserved
 * single-line row (line 2) that clips overflow instead of wrapping, and the
 * memo indicator / chevron stay pinned right — none of these change the row's
 * height.
 */
export function PlayerListCard({ player }: PlayerListCardProps) {
	return (
		<Link
			className="flex h-16 items-center gap-3 rounded-lg border border-border bg-card px-4 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ playerId: player.id }}
			to="/players/$playerId"
		>
			<div className="flex min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden">
				<p className="truncate font-medium text-foreground text-sm">
					{player.name}
				</p>
				<div className="flex h-5 items-center gap-1 overflow-hidden">
					{player.tags.map((tag) => (
						<ColorBadge className="shrink-0" color={tag.color} key={tag.id}>
							{tag.name}
						</ColorBadge>
					))}
				</div>
			</div>
			{player.memo ? (
				<IconNote
					aria-label="Has memo"
					className="size-4 shrink-0 text-muted-foreground"
					role="img"
				/>
			) : null}
			<IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
