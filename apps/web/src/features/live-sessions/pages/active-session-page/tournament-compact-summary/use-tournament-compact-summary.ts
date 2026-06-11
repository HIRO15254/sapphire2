import { useElapsedTime } from "@/shared/hooks/use-elapsed-time";
import { formatCompactNumber } from "@/utils/format-number";

interface TournamentCompactSummaryInput {
	averageStack: number | null;
	remainingPlayers: number | null;
	startedAt: Date | string | number;
	totalEntries: number | null;
}

export interface TournamentCompactSummaryViewModel {
	averageStackFormatted: string;
	duration: string;
	fieldEntry: string;
}

export function useTournamentCompactSummary(
	summary: TournamentCompactSummaryInput
): TournamentCompactSummaryViewModel {
	const duration = useElapsedTime(summary.startedAt);

	const fieldEntry =
		summary.remainingPlayers === null && summary.totalEntries === null
			? "-"
			: `${summary.remainingPlayers ?? "-"}/${summary.totalEntries ?? "-"}`;

	const averageStackFormatted =
		summary.averageStack === null
			? "-"
			: formatCompactNumber(summary.averageStack);

	return {
		duration,
		fieldEntry,
		averageStackFormatted,
	};
}
