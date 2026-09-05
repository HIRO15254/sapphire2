import { useState } from "react";
import type { RoomValues } from "@/features/rooms/hooks/use-rooms";
import { useRooms } from "@/features/rooms/hooks/use-rooms";

export function useRoomsPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	const {
		rooms,
		isLoading,
		isInitialLoadError: isError,
		onRetry,
		isCreatePending,
		create,
		toggleFavorite,
	} = useRooms();

	const handleCreate = (values: RoomValues) => {
		create(values).then(
			() => setIsCreateOpen(false),
			() => {
				// The mutation cache reports the error; retain the form for retry.
			}
		);
	};

	const handleToggleFavorite = (id: string) => {
		toggleFavorite(id).catch(() => {
			// The mutation cache reports the error and the data hook rolls back.
		});
	};

	return {
		rooms,
		isLoading,
		isError,
		onRetry,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
		handleToggleFavorite,
	};
}
