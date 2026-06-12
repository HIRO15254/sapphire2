import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { ArchivedRingGames } from "../archived-ring-games";
import { RingGameList } from "../ring-game-list";
import { RingGameListSkeleton } from "../ring-game-list-skeleton";
import type { CurrencyOption } from "../ring-game-row";

interface RingGameContentProps {
	activeGames: RingGame[];
	activeLoading: boolean;
	archivedGames: RingGame[];
	archivedLoading: boolean;
	currencies: CurrencyOption[];
	onOpenActions: (game: RingGame) => void;
	showArchived: boolean;
}

export function RingGameContent({
	activeGames,
	activeLoading,
	archivedGames,
	archivedLoading,
	currencies,
	onOpenActions,
	showArchived,
}: RingGameContentProps) {
	if (activeLoading) {
		return <RingGameListSkeleton />;
	}
	return (
		<>
			{activeGames.length === 0 && !showArchived ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					No cash games yet.
				</p>
			) : null}
			{activeGames.length > 0 ? (
				<RingGameList
					currencies={currencies}
					games={activeGames}
					onOpenActions={onOpenActions}
				/>
			) : null}
			{showArchived ? (
				<div className="mt-1 flex flex-col gap-2 border-border border-t border-dashed pt-3">
					<p className="t-meta uppercase tracking-wide">Archived</p>
					<ArchivedRingGames
						currencies={currencies}
						games={archivedGames}
						isLoading={archivedLoading}
						onOpenActions={onOpenActions}
					/>
				</div>
			) : null}
		</>
	);
}
