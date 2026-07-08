import { createFileRoute } from "@tanstack/react-router";
import { GameVariantsPage } from "@/features/game-variants/pages/game-variants-page";

export const Route = createFileRoute("/game-variants")({
	component: GameVariantsPage,
});
