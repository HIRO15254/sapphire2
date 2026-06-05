import { createFileRoute } from "@tanstack/react-router";
import { RoomsPage } from "@/features/rooms/pages/rooms-page";

export const Route = createFileRoute("/rooms/")({
	component: RoomsPage,
});
