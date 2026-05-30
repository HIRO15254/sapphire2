import { IconNote } from "@tabler/icons-react";
import { ColorBadge } from "@/features/players/components/color-badge";
import type { PlayerItem } from "@/features/players/hooks/use-players";
import { EntityListItem } from "@/shared/components/management/entity-list-item";
import { RichTextContent } from "@/shared/components/ui/rich-text-content";

interface PlayerCardProps {
	onDelete: (id: string) => void;
	onEdit: (player: PlayerItem) => void;
	player: PlayerItem;
}

export function PlayerCard({ player, onEdit, onDelete }: PlayerCardProps) {
	return (
		<EntityListItem
			deleteLabel="player"
			onDelete={() => onDelete(player.id)}
			onEdit={() => onEdit(player)}
			summary={
				<div className="flex w-full items-start justify-between gap-3 text-left">
					<div className="min-w-0 flex-1">
						<span className="font-medium text-sm">{player.name}</span>
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
							className="mt-0.5 shrink-0 text-muted-foreground"
							size={14}
						/>
					) : null}
				</div>
			}
		>
			{player.memo ? (
				<RichTextContent className="text-xs" html={player.memo} />
			) : (
				<p className="text-muted-foreground text-xs">No memo yet.</p>
			)}
		</EntityListItem>
	);
}
