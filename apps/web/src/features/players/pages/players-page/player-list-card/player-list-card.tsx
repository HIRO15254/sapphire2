import { IconChevronRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { tagBadgeClassName } from "@/features/players/utils/tag-badge-class-name";
import { Badge } from "@/shared/components/ui/badge";

interface PlayerListCardProps {
	player: {
		id: string;
		name: string;
		tags: Array<{ color: string; id: string; name: string }>;
	};
}

const MAX_VISIBLE_TAGS = 2;

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
						<Badge
							className={tagBadgeClassName(tag.color, "shrink-0")}
							key={tag.id}
						>
							{tag.name}
						</Badge>
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
