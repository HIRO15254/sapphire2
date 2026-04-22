import { useState } from "react";
import { useTournamentSession } from "@/live-sessions/hooks/use-tournament-session";

export function useTournamentSessionPage(sessionId: string) {
	const tournamentSession = useTournamentSession(sessionId);
	const [isTimerDialogOpen, setIsTimerDialogOpen] = useState(false);

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
		isTimerDialogOpen,
		setIsTimerDialogOpen,
		handleOpenTimerDialog,
		handleClearTimer,
		handleSubmitTimer,
	};
}
