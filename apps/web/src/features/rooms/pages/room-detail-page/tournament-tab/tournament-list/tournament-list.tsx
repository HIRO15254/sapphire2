import type { Tournament } from "@/features/rooms/hooks/use-tournaments";
import { type CurrencyOption, TournamentRow } from "../tournament-row";

interface TournamentListProps {
	currencies: CurrencyOption[];
	onOpenActions: (tournament: Tournament) => void;
	tournaments: Tournament[];
}

export function TournamentList({
	tournaments,
	currencies,
	onOpenActions,
}: TournamentListProps) {
	return (
		<div className="flex flex-col gap-2">
			{tournaments.map((tournament) => (
				<TournamentRow
					currencies={currencies}
					key={tournament.id}
					onOpenActions={onOpenActions}
					tournament={tournament}
				/>
			))}
		</div>
	);
}
