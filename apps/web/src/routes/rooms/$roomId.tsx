import { createFileRoute } from "@tanstack/react-router";
import { RoomDetailPage } from "@/features/rooms/pages/room-detail-page";

export const Route = createFileRoute("/rooms/$roomId")({
	component: RoomDetailRoute,
});

function RoomDetailRoute() {
	const { roomId } = Route.useParams();
	return <RoomDetailPage roomId={roomId} />;
}
