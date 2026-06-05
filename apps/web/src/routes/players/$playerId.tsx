import { createFileRoute } from "@tanstack/react-router";
import { PlayerDetailPage } from "@/features/players/pages/player-detail-page";

export const Route = createFileRoute("/players/$playerId")({
	component: PlayerDetailRoute,
});

function PlayerDetailRoute() {
	const { playerId } = Route.useParams();
	return <PlayerDetailPage playerId={playerId} />;
}
