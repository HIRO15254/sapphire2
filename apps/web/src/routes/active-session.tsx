import { createFileRoute } from "@tanstack/react-router";
import { ActiveSessionPage } from "@/features/live-sessions/pages/active-session-page";

export const Route = createFileRoute("/active-session")({
	component: ActiveSessionPage,
});
