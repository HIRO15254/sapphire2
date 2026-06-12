import type { RingGame } from "@/features/rooms/hooks/use-ring-games";
import { type CurrencyOption, RingGameRow } from "../ring-game-row";

interface RingGameListProps {
	currencies: CurrencyOption[];
	games: RingGame[];
	onOpenActions: (game: RingGame) => void;
}

export function RingGameList({
	games,
	currencies,
	onOpenActions,
}: RingGameListProps) {
	return (
		<div className="flex flex-col gap-2">
			{games.map((game) => (
				<RingGameRow
					currencies={currencies}
					game={game}
					key={game.id}
					onOpenActions={onOpenActions}
				/>
			))}
		</div>
	);
}
