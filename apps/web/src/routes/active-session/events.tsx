import { createFileRoute } from "@tanstack/react-router";
import { ActiveSessionEventsPage } from "@/features/live-sessions/pages/active-session-events-page";

export const Route = createFileRoute("/active-session/events")({
	component: ActiveSessionEventsPage,
});
