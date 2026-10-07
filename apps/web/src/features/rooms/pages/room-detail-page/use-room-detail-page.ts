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
		archivedRooms,
		archivedLoading,
		isArchivedError,
		onRetryArchived,
		isLoading,
		isFetching = false,
		isInitialLoadError,
		onRetry,
		isUpdatePending,
		update,
		delete: deleteRoom,
		toggleFavorite,
		archive,
		restore,
	} = useRooms({ showArchived: true });

	const room =
		[...rooms, ...archivedRooms].find((s) => s.id === roomId) ?? null;

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

	const handleConfirmDelete = async () => {
		setConfirmingDelete(false);
		try {
			await deleteRoom(roomId);
			await navigate({ to: "/rooms" });
		} catch {
			return;
		}
	};
	const handleArchive = () => {
		setIsActionsOpen(false);
		archive(roomId).catch(() => undefined);
	};
	const handleRestore = () => {
		setIsActionsOpen(false);
		restore(roomId).catch(() => undefined);
	};

	return {
		room,
		canDelete: room?.isReferenced === false,
		isLoading: !room && (isLoading || archivedLoading || isFetching),
		isInitialLoadError: !room && (isInitialLoadError || isArchivedError),
		onRetry: () => {
			onRetry();
			onRetryArchived();
		},
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
		handleArchive,
		handleRestore,
	};
}
