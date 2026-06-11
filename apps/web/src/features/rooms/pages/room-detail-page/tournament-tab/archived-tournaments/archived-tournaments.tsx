import type { Tournament } from "@/features/rooms/hooks/use-tournaments";
import { TournamentList } from "../tournament-list";
import { TournamentListSkeleton } from "../tournament-list-skeleton";
import type { CurrencyOption } from "../tournament-row";

interface ArchivedTournamentsProps {
	currencies: CurrencyOption[];
	isLoading: boolean;
	onOpenActions: (tournament: Tournament) => void;
	tournaments: Tournament[];
}

export function ArchivedTournaments({
	tournaments,
	currencies,
	isLoading,
	onOpenActions,
}: ArchivedTournamentsProps) {
	if (isLoading) {
		return <TournamentListSkeleton />;
	}
	if (tournaments.length === 0) {
		return (
			<p className="py-2 text-center text-muted-foreground text-xs">
				No archived tournaments.
			</p>
		);
	}
	return (
		<TournamentList
			currencies={currencies}
			onOpenActions={onOpenActions}
			tournaments={tournaments}
		/>
	);
}
