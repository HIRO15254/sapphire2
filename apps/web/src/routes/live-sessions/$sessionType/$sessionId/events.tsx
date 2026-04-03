import { createFileRoute } from "@tanstack/react-router";
import { SessionEventsScene } from "@/components/session-events/session-events-scene";

export const Route = createFileRoute(
	"/live-sessions/$sessionType/$sessionId/events"
)({
	component: SessionEventsPage,
});

function SessionEventsPage() {
	const { sessionId, sessionType } = Route.useParams();

	return (
		<SessionEventsScene
			sessionId={sessionId}
			sessionType={sessionType === "tournament" ? "tournament" : "cash_game"}
		/>
	);
}
