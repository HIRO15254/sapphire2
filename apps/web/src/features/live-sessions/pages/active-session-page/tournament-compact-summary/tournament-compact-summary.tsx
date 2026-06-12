import type { TournamentSummaryData } from "../tournament-session/use-tournament-session-view";
import { useTournamentCompactSummary } from "./use-tournament-compact-summary";

export function TournamentCompactSummary({
	summary,
}: {
	summary: TournamentSummaryData & { startedAt: Date | string | number };
}) {
	const vm = useTournamentCompactSummary(summary);

	return (
		<div className="flex rounded-md border">
			<div className="flex flex-1 flex-col gap-0.5 px-3 py-2">
				<span className="text-muted-foreground text-xs">Time</span>
				<p className="font-semibold">{vm.duration}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">Field/Entry</span>
				<p className="font-semibold">{vm.fieldEntry}</p>
			</div>
			<div className="flex flex-1 flex-col gap-0.5 border-l px-3 py-2">
				<span className="text-muted-foreground text-xs">Avg Stack</span>
				<p className="font-semibold">{vm.averageStackFormatted}</p>
			</div>
		</div>
	);
}
