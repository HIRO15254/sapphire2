import { createFileRoute } from "@tanstack/react-router";
import { LiveSessionPage } from "@/features/live-sessions/pages/live-session-page";

export const Route = createFileRoute("/active-session-next")({
	component: LiveSessionPage,
});
