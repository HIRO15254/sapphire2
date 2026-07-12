import { createFileRoute } from "@tanstack/react-router";
import { GamesPage } from "@/features/games/pages/games-page";

export const Route = createFileRoute("/games")({
	component: GamesPage,
});
