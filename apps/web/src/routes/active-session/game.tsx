import { createFileRoute } from "@tanstack/react-router";
import { ActiveSessionGameScene } from "@/features/live-sessions/components/active-session-game-scene";

export const Route = createFileRoute("/active-session/game")({
	component: ActiveSessionGamePage,
});

function ActiveSessionGamePage() {
	return <ActiveSessionGameScene />;
}
