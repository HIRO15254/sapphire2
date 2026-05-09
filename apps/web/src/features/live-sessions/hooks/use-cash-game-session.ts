import { useLiveSession } from "@/features/live-sessions/hooks/use-live-session";

export function useCashGameSession(sessionId: string) {
	const { session, isDiscardPending, discard } = useLiveSession(sessionId);

	return {
		session,
		ringGames: [] as unknown[],
		isDiscardPending,
		discard,
	};
}
