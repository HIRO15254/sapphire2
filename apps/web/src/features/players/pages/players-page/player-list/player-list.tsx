import { IconPlus, IconUsers } from "@tabler/icons-react";
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
	/** A tag filter is active — changes the empty-state copy and hides the CTA. */
	isFiltered: boolean;
	/** Initial players fetch is in flight (no rows yet). */
	isLoading: boolean;
	/** Open the create sheet — wired to the empty-state CTA. */
	onCreate: () => void;
	players: PlayerListItem[];
}

const SKELETON_COUNT = 5;

/**
 * Owns the list surface's loading / empty / data switch, mirroring
 * `StoreList` / `CurrencyList`: the consumer passes `isLoading` + `players` and
 * the component decides what to render. The empty branch splits on `isFiltered`
 * so a tag filter that matches nothing reads differently from an empty account.
 */
export function PlayerList({
	isFiltered,
	isLoading,
	onCreate,
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

	if (players.length === 0) {
		if (isFiltered) {
			return (
				<EmptyState
					description="Try changing the selected tags."
					heading="No players match the selected filters"
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
