import { IconPlus, IconUsers } from "@tabler/icons-react";
import { QueryError } from "@/shared/components/query-error";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { PlayerListCard, PlayerListCardSkeleton } from "../player-list-card";

interface PlayerListItem {
	id: string;
	memo?: string | null;
	name: string;
	tags: Array<{ color: string; id: string; name: string }>;
}

interface PlayerListProps {
	isInitialLoadError?: boolean;
	isLoading: boolean;
	isSearching: boolean;
	onCreate: () => void;
	onRetry?: () => void;
	players: PlayerListItem[];
}

const SKELETON_COUNT = 5;

export function PlayerList({
	isInitialLoadError = false,
	isLoading,
	isSearching,
	onCreate,
	onRetry = () => undefined,
	players,
}: PlayerListProps) {
	if (isLoading) {
		return (
			<div
				aria-hidden
				className="flex flex-col gap-2"
				data-testid="player-list-skeleton"
			>
				{Array.from({ length: SKELETON_COUNT }, (_, i) => i).map((i) => (
					<PlayerListCardSkeleton key={i} />
				))}
			</div>
		);
	}

	if (isInitialLoadError) {
		return <QueryError message="Unable to load players" onRetry={onRetry} />;
	}

	if (players.length === 0) {
		if (isSearching) {
			return (
				<EmptyState
					description="Try a different name or tag."
					heading="No players match your search"
					icon={<IconUsers size={48} />}
				/>
			);
		}
		return (
			<EmptyState
				action={
					<Button onClick={onCreate} variant="outline">
						<IconPlus size={16} />
						New player
					</Button>
				}
				description="Create your first player to start tracking opponents."
				heading="No players yet"
				icon={<IconUsers size={48} />}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{players.map((player) => (
				<PlayerListCard key={player.id} player={player} />
			))}
		</div>
	);
}
