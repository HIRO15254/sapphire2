import { createFileRoute } from "@tanstack/react-router";
import { ActiveSessionGamePage } from "@/features/live-sessions/pages/active-session-game-page";

export const Route = createFileRoute("/active-session/game")({
	component: ActiveSessionGamePage,
});
