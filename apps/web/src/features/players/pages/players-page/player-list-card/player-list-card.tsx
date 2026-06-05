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

export function PlayerListCard({ player }: PlayerListCardProps) {
	return (
		<Link
			className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ playerId: player.id }}
			to="/players/$playerId"
		>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-foreground text-sm">
					{player.name}
				</p>
				{player.tags.length > 0 ? (
					<div className="mt-1 flex flex-wrap gap-1">
						{player.tags.map((tag) => (
							<ColorBadge color={tag.color} key={tag.id}>
								{tag.name}
							</ColorBadge>
						))}
					</div>
				) : null}
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
