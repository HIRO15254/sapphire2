import { useState } from "react";
import { EntityListItem } from "@/shared/components/management/entity-list-item";
import { RingGameTab } from "@/stores/components/ring-game-tab";
import { TournamentTab } from "@/stores/components/tournament-tab";

interface StoreCardProps {
	onDelete: (id: string) => void;
	onEdit: (store: { id: string; memo?: string | null; name: string }) => void;
	store: {
		id: string;
		memo?: string | null;
		name: string;
	};
}

export function StoreCard({ store, onEdit, onDelete }: StoreCardProps) {
	const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

	const handleToggleGame = (id: string | null) => {
		setExpandedGameId(id);
	};

	return (
		<EntityListItem
			contentClassName="space-y-3"
			deleteLabel="store"
			onDelete={() => onDelete(store.id)}
			onEdit={() => onEdit(store)}
			summary={
				<div className="min-w-0 flex-1 text-left">
					<span className="font-medium text-sm">{store.name}</span>
					{store.memo ? (
						<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
							{store.memo}
						</p>
					) : null}
				</div>
			}
		>
			<RingGameTab
				expandedGameId={expandedGameId}
				onToggleGame={handleToggleGame}
				storeId={store.id}
			/>
			<TournamentTab
				expandedGameId={expandedGameId}
				onToggleGame={handleToggleGame}
				storeId={store.id}
			/>
		</EntityListItem>
	);
}
