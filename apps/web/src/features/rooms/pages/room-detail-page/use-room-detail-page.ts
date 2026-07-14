import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { RoomValues } from "@/features/rooms/hooks/use-rooms";
import { useRooms } from "@/features/rooms/hooks/use-rooms";

export function useRoomDetailPage(roomId: string) {
	const [isActionsOpen, setIsActionsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const navigate = useNavigate();

	const {
		rooms,
		isLoading,
		isInitialLoadError,
		onRetry,
		isUpdatePending,
		update,
		delete: deleteRoom,
		toggleFavorite,
	} = useRooms();

	const room = rooms.find((s) => s.id === roomId) ?? null;

	const handleToggleFavorite = () => {
		setIsActionsOpen(false);
		toggleFavorite(roomId);
	};

	const openEditFromActions = () => {
		setIsActionsOpen(false);
		setIsEditOpen(true);
	};

	const openDeleteFromActions = () => {
		setIsActionsOpen(false);
		setConfirmingDelete(true);
	};

	const handleEdit = (values: RoomValues) => {
		update({ id: roomId, ...values }).then(() => {
			setIsEditOpen(false);
		});
	};

	const handleConfirmDelete = () => {
		deleteRoom(roomId);
		setConfirmingDelete(false);
		navigate({ to: "/rooms" });
	};

	return {
		room,
		isLoading,
		isInitialLoadError,
		onRetry,
		isUpdatePending,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		handleToggleFavorite,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
	};
}
