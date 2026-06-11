import type { Tournament } from "@/features/rooms/hooks/use-tournaments";
import { ArchivedTournaments } from "../archived-tournaments";
import { TournamentList } from "../tournament-list";
import { TournamentListSkeleton } from "../tournament-list-skeleton";
import type { CurrencyOption } from "../tournament-row";

interface TournamentContentProps {
	activeLoading: boolean;
	activeTournaments: Tournament[];
	archivedLoading: boolean;
	archivedTournaments: Tournament[];
	currencies: CurrencyOption[];
	onOpenActions: (tournament: Tournament) => void;
	showArchived: boolean;
}

export function TournamentContent({
	activeLoading,
	activeTournaments,
	archivedLoading,
	archivedTournaments,
	currencies,
	onOpenActions,
	showArchived,
}: TournamentContentProps) {
	if (activeLoading) {
		return <TournamentListSkeleton />;
	}
	return (
		<>
			{activeTournaments.length === 0 && !showArchived ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					No tournaments yet.
				</p>
			) : null}
			{activeTournaments.length > 0 ? (
				<TournamentList
					currencies={currencies}
					onOpenActions={onOpenActions}
					tournaments={activeTournaments}
				/>
			) : null}
			{showArchived ? (
				<div className="mt-1 flex flex-col gap-2 border-border border-t border-dashed pt-3">
					<p className="t-meta uppercase tracking-wide">Archived</p>
					<ArchivedTournaments
						currencies={currencies}
						isLoading={archivedLoading}
						onOpenActions={onOpenActions}
						tournaments={archivedTournaments}
					/>
				</div>
			) : null}
		</>
	);
}
