import { ColorBadge } from "@/features/players/components/color-badge";
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
 * Inline tag cluster matching the Players list badge style (`ColorBadge`),
 * shown on the same line as the player name. As many tags as fit are rendered;
 * the rest collapse into a `+N` badge only once they no longer fit the line
 * (width is measured, not a fixed count).
 */
export function PlayerTagBadges({ tags }: PlayerTagBadgesProps) {
	const { containerRef, ghostRef, visibleCount } = usePlayerTagBadges(
		tags.length
	);

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
					<ColorBadge color={tag.color} key={tag.id}>
						{tag.name}
					</ColorBadge>
				))}
				<Badge variant="secondary">+{tags.length}</Badge>
			</span>

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
		</span>
	);
}
