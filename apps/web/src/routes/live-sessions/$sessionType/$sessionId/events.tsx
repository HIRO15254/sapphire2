import { createFileRoute } from "@tanstack/react-router";
import { SessionEventsPage } from "@/features/live-sessions/pages/session-events-page";

export const Route = createFileRoute(
	"/live-sessions/$sessionType/$sessionId/events"
)({
	component: SessionEventsRoute,
});

function SessionEventsRoute() {
	const { sessionId, sessionType } = Route.useParams();

	return (
		<SessionEventsPage
			sessionId={sessionId}
			sessionType={sessionType === "tournament" ? "tournament" : "cash_game"}
		/>
	);
}
