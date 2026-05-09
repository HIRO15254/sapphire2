import { useLiveSession } from "@/features/live-sessions/hooks/use-live-session";

export function useTournamentSession(sessionId: string) {
	const {
		session,
		isDiscardPending,
		discard,
		isUpdatingTimer,
		updateTimerStartedAt,
	} = useLiveSession(sessionId);

	return {
		session,
		isDiscardPending,
		discard,
		isUpdatingTimer,
		updateTimerStartedAt,
	};
}
