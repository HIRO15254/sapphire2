import { createFileRoute } from "@tanstack/react-router";
import { SessionEventsScene } from "@/features/live-sessions/components/session-events-scene";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

export const Route = createFileRoute("/active-session/events")({
	component: ActiveSessionEventsPage,
});

function ActiveSessionEventsPage() {
	const { activeSession, isLoading } = useActiveSession();

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
