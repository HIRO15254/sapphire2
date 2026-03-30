import { useState } from "react";
import { RingGameTab } from "@/components/stores/ring-game-tab";
import { TournamentTab } from "@/components/stores/tournament-tab";
import { ExpandableCard } from "@/components/ui/expandable-card";

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

	const handleToggleGame = (id: string) => {
		setExpandedGameId((prev) => (prev === id ? null : id));
	};

	return (
		<ExpandableCard
			deleteLabel="store"
			header={
				<div className="min-w-0 flex-1">
					<span className="font-medium text-sm">{store.name}</span>
					{store.memo && (
						<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
							{store.memo}
						</p>
					)}
				</div>
			}
			onDelete={() => onDelete(store.id)}
			onEdit={() => onEdit(store)}
		>
			<div className="space-y-3">
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
			</div>
		</ExpandableCard>
	);
}
