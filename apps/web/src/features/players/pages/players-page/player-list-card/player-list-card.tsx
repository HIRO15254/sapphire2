import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { ColorBadge } from "@/features/players/components/color-badge";
import { Badge } from "@/shared/components/ui/badge";

interface PlayerListCardProps {
	player: {
		id: string;
		name: string;
		tags: Array<{ color: string; id: string; name: string }>;
	};
}

/** Tags shown inline before collapsing the remainder into a `+N` badge. */
const MAX_VISIBLE_TAGS = 2;

/**
 * Fixed-height list row so every card is the same size. The name and tags share
 * a single line: the name truncates to yield space, tags sit inline next to it,
 * and any beyond {@link MAX_VISIBLE_TAGS} collapse into a `+N` badge so the tag
 * cluster never grows the row. The chevron is pinned right.
 */
export function PlayerListCard({ player }: PlayerListCardProps) {
	const visibleTags = player.tags.slice(0, MAX_VISIBLE_TAGS);
	const overflowCount = player.tags.length - visibleTags.length;

	return (
		<Link
			className="flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-4 text-card-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			params={{ playerId: player.id }}
			to="/players/$playerId"
		>
			<span className="min-w-0 truncate font-medium text-foreground text-sm">
				{player.name}
			</span>
			{player.tags.length > 0 ? (
				<div className="flex shrink-0 items-center gap-1">
					{visibleTags.map((tag) => (
						<ColorBadge className="shrink-0" color={tag.color} key={tag.id}>
							{tag.name}
						</ColorBadge>
					))}
					{overflowCount > 0 ? (
						<Badge className="shrink-0" variant="secondary">
							+{overflowCount}
						</Badge>
					) : null}
				</div>
			) : null}
			<IconChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
		</Link>
	);
}
