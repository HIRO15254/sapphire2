import { useState } from "react";
import { useLiveSession } from "@/features/live-sessions/hooks/use-live-session";

export function useTournamentSessionPage(sessionId: string) {
	const tournamentSession = useLiveSession(sessionId);
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
