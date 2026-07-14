import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { PlayerFormValues } from "@/features/players/components/player-form";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";

export function usePlayerDetailPage(playerId: string) {
	const [isActionsOpen, setIsActionsOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const navigate = useNavigate();

	const {
		player,
		availableTags,
		createTag,
		isLoading,
		isInitialLoadError,
		onRetry,
		isSaving,
		updatePlayer,
		deletePlayer,
	} = usePlayerDetail(playerId);

	const openEditFromActions = () => {
		setIsActionsOpen(false);
		setIsEditOpen(true);
	};

	const openDeleteFromActions = () => {
		setIsActionsOpen(false);
		setConfirmingDelete(true);
	};

	const handleEdit = (values: PlayerFormValues) => {
		// updatePlayer is optimistic (mutate), so the sheet can close immediately —
		// the cache already reflects the edit and rolls back on error.
		updatePlayer({ id: playerId, ...values });
		setIsEditOpen(false);
	};

	const handleConfirmDelete = () => {
		deletePlayer(playerId);
		setConfirmingDelete(false);
		navigate({ to: "/players" });
	};

	return {
		player,
		availableTags,
		createTag,
		isLoading,
		isInitialLoadError,
		onRetry,
		isSaving,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
	};
}
