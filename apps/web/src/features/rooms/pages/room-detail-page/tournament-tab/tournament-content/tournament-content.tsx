import type { Tournament } from "@/features/rooms/hooks/use-tournaments";
import { QueryError } from "@/shared/components/query-error";
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
	isInitialLoadError: boolean;
	onOpenActions: (tournament: Tournament) => void;
	onRetry: () => void;
	showArchived: boolean;
}

export function TournamentContent({
	activeLoading,
	activeTournaments,
	archivedLoading,
	isInitialLoadError,
	onRetry,
	archivedTournaments,
	currencies,
	onOpenActions,
	showArchived,
}: TournamentContentProps) {
	if (isInitialLoadError) {
		return (
			<QueryError message="Unable to load tournaments" onRetry={onRetry} />
		);
	}
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
