import { createFileRoute } from "@tanstack/react-router";
import { SessionDetailPage } from "@/features/sessions/pages/session-detail-page";

export const Route = createFileRoute("/sessions/$sessionId")({
	component: SessionDetailRoute,
});

function SessionDetailRoute() {
	const { sessionId } = Route.useParams();
	return <SessionDetailPage sessionId={sessionId} />;
}
