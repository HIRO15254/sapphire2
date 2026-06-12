import { useState } from "react";
import { useActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene";
import { useTournamentSession } from "@/features/live-sessions/hooks/use-tournament-session";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";

export interface TournamentSummaryData {
	averageStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
}

function buildTournamentSummary(
	summary: Record<string, unknown>
): TournamentSummaryData {
	return {
		averageStack:
			typeof summary.averageStack === "number" ? summary.averageStack : null,
		remainingPlayers:
			typeof summary.remainingPlayers === "number"
				? summary.remainingPlayers
				: null,
		totalEntries:
			typeof summary.totalEntries === "number" ? summary.totalEntries : null,
	};
}

/**
 * View model for the tournament branch of the active-session page: timer
 * dialog state over useTournamentSession plus the summary / blind-structure /
 * hero-seat derivations the scene needs.
 */
export function useTournamentSessionView(sessionId: string) {
	const tournamentSession = useTournamentSession(sessionId);
	const [isTimerDialogOpen, setIsTimerDialogOpen] = useState(false);

	const session = tournamentSession.session;
	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition,
		sessionId,
		sessionType: "tournament",
	});

	const tournamentSummary: TournamentSummaryData | null = session
		? buildTournamentSummary(
				((session as { summary?: Record<string, unknown> }).summary ??
					{}) as Record<string, unknown>
			)
		: null;

	const blindLevels = ((session as { blindLevels?: TournamentBlindLevel[] })
		?.blindLevels ?? []) as TournamentBlindLevel[];
	const timerStartedAt =
		(session as { timerStartedAt?: Date | string | number | null })
			?.timerStartedAt ?? null;
	const hasStructure = blindLevels.length > 0;
	const tableSize =
		(session as { tableSize?: number | null })?.tableSize ?? null;

	const handleOpenTimerDialog = () => {
		setIsTimerDialogOpen(true);
	};

	const handleClearTimer = () => {
		tournamentSession.updateTimerStartedAt(null);
		setIsTimerDialogOpen(false);
	};

	const handleSubmitTimer = (value: Date) => {
		tournamentSession.updateTimerStartedAt(value);
		setIsTimerDialogOpen(false);
	};

	return {
		...tournamentSession,
		blindLevels,
		handleClearTimer,
		handleOpenTimerDialog,
		handleSubmitTimer,
		hasStructure,
		isTimerDialogOpen,
		sceneState,
		setIsTimerDialogOpen,
		tableSize,
		timerStartedAt,
		tournamentSummary,
	};
}
