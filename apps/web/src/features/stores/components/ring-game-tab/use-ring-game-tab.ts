import { useState } from "react";
import type {
	RingGame,
	RingGameFormValues,
} from "@/features/stores/hooks/use-ring-games";
import { useRingGames } from "@/features/stores/hooks/use-ring-games";

interface UseRingGameTabOptions {
	storeId: string;
}

export function useRingGameTab({ storeId }: UseRingGameTabOptions) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<RingGame | null>(null);
	const [actionsTarget, setActionsTarget] = useState<RingGame | null>(null);
	const [pendingDelete, setPendingDelete] = useState<RingGame | null>(null);

	const {
		activeGames,
		archivedGames,
		currencies,
		activeLoading,
		archivedLoading,
		isCreatePending,
		isUpdatePending,
		create,
		update,
		archive,
		restore,
		delete: deleteGame,
	} = useRingGames({ storeId, showArchived });

	const toggleArchived = () => setShowArchived((prev) => !prev);

	const handleCreate = (values: RingGameFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleUpdate = (values: RingGameFormValues) => {
		if (!editingGame) {
			return;
		}
		update({ id: editingGame.id, ...values }).then(() => {
			setEditingGame(null);
		});
	};

	const openActions = (game: RingGame) => setActionsTarget(game);
	const closeActions = () => setActionsTarget(null);

	const openEditFromActions = () => {
		if (actionsTarget) {
			setEditingGame(actionsTarget);
		}
		setActionsTarget(null);
	};

	const openDeleteFromActions = () => {
		if (actionsTarget) {
			setPendingDelete(actionsTarget);
		}
		setActionsTarget(null);
	};

	const handleArchiveFromActions = () => {
		if (actionsTarget) {
			archive(actionsTarget.id);
		}
		setActionsTarget(null);
	};

	const handleRestoreFromActions = () => {
		if (actionsTarget) {
			restore(actionsTarget.id);
		}
		setActionsTarget(null);
	};

	const cancelDelete = () => setPendingDelete(null);

	const handleConfirmDelete = () => {
		if (!pendingDelete) {
			return;
		}
		deleteGame(pendingDelete.id);
		setPendingDelete(null);
	};

	return {
		showArchived,
		toggleArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingGame,
		setEditingGame,
		actionsTarget,
		pendingDelete,
		activeGames,
		archivedGames,
		currencies,
		activeLoading,
		archivedLoading,
		isCreatePending,
		isUpdatePending,
		handleCreate,
		handleUpdate,
		openActions,
		closeActions,
		openEditFromActions,
		openDeleteFromActions,
		handleArchiveFromActions,
		handleRestoreFromActions,
		cancelDelete,
		handleConfirmDelete,
	};
}
