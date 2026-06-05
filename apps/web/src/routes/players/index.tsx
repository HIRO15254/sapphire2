import { createFileRoute } from "@tanstack/react-router";
import { PlayersPage } from "@/features/players/pages/players-page";

export const Route = createFileRoute("/players/")({
	component: PlayersPage,
});
