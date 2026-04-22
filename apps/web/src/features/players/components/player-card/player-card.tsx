import { IconNote } from "@tabler/icons-react";
import { ColorBadge } from "@/features/players/components/color-badge";
import { EntityListItem } from "@/shared/components/management/entity-list-item";
import { useSafeHtml } from "./use-player-card";

function SafeHtml({ className, html }: { className?: string; html: string }) {
	const { ref } = useSafeHtml(html);
	return <div className={className} ref={ref} />;
}

interface PlayerCardProps {
	onDelete: (id: string) => void;
	onEdit: (player: PlayerCardProps["player"]) => void;
	player: {
		createdAt: string;
		id: string;
		memo: string | null;
		name: string;
		tags: Array<{ id: string; name: string; color: string }>;
		updatedAt: string;
		userId: string;
	};
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
				<SafeHtml
					className="prose prose-sm dark:prose-invert max-w-none text-xs [&_*:first-child]:mt-0 [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:font-semibold [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-semibold [&_h3]:text-base [&_li]:my-0 [&_li_p]:my-0 [&_ol]:my-1 [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-5"
					html={player.memo}
				/>
			) : (
				<p className="text-muted-foreground text-xs">No memo yet.</p>
			)}
		</EntityListItem>
	);
}
