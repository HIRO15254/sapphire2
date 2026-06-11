import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";
import { useActiveSessionEventsPage } from "./use-active-session-events-page";

export function ActiveSessionEventsPage() {
	const { activeSession, isLoading } = useActiveSessionEventsPage();

	return (
		<SessionEventsScene
			emptySessionMessage="No active session"
			refetchInterval={3000}
			sessionId={activeSession?.id ?? ""}
			sessionLoading={isLoading}
			sessionType={activeSession?.type ?? "cash_game"}
		/>
	);
}
