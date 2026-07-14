import { tagBadgeClassName } from "@/features/players/utils/tag-badge-class-name";
import { Badge } from "@/shared/components/ui/badge";
import { usePlayerTagBadges } from "./use-player-tag-badges";

interface PlayerTag {
	color: string;
	id: string;
	name: string;
}

interface PlayerTagBadgesProps {
	tags: PlayerTag[];
}

/**
 * Inline tag cluster matching the Players list badge style,
 * shown on the same line as the player name. As many tags as fit are rendered;
 * the rest collapse into a `+N` badge only once they no longer fit the line
 * (width is measured, not a fixed count).
 */
export function PlayerTagBadges({ tags }: PlayerTagBadgesProps) {
	const { containerRef, ghostRef, visibleCount } = usePlayerTagBadges(tags);

	if (tags.length === 0) {
		return null;
	}

	const visibleTags = tags.slice(0, visibleCount);
	const overflowCount = tags.length - visibleTags.length;

	return (
		<span
			className="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
			data-testid="tag-cluster"
			ref={containerRef}
		>
			{/* Measurement layer: every tag + a sample +N badge, kept out of the
			    layout and a11y tree. Drives how many tags actually fit. */}
			<span
				aria-hidden
				className="pointer-events-none invisible absolute flex items-center gap-1"
				data-testid="tag-ghost"
				ref={ghostRef}
			>
				{tags.map((tag) => (
					<Badge className={tagBadgeClassName(tag.color)} key={tag.id}>
						{tag.name}
					</Badge>
				))}
				<Badge variant="secondary">+{tags.length}</Badge>
			</span>

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
		</span>
	);
}
