import { useState } from "react";
import type { RoomValues } from "@/features/rooms/hooks/use-rooms";
import { useRooms } from "@/features/rooms/hooks/use-rooms";

export function useRoomsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const { rooms, isLoading, isCreatePending, create, toggleFavorite } =
		useRooms();

	const handleCreate = (values: RoomValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleToggleFavorite = (id: string) => {
		toggleFavorite(id);
	};

	return {
		rooms,
		isLoading,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
		handleToggleFavorite,
	};
}
