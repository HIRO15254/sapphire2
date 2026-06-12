import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { RingGameList } from "../ring-game-list";
import { RingGameListSkeleton } from "../ring-game-list-skeleton";
import type { CurrencyOption } from "../ring-game-row";

interface ArchivedRingGamesProps {
	currencies: CurrencyOption[];
	games: RingGame[];
	isLoading: boolean;
	onOpenActions: (game: RingGame) => void;
}

export function ArchivedRingGames({
	games,
	currencies,
	isLoading,
	onOpenActions,
}: ArchivedRingGamesProps) {
	if (isLoading) {
		return <RingGameListSkeleton />;
	}
	if (games.length === 0) {
		return (
			<p className="py-2 text-center text-muted-foreground text-xs">
				No archived cash games.
			</p>
		);
	}
	return (
		<RingGameList
			currencies={currencies}
			games={games}
			onOpenActions={onOpenActions}
		/>
	);
}
