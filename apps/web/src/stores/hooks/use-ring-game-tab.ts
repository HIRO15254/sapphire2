import { useState } from "react";
import type {
	RingGame,
	RingGameFormValues,
} from "@/stores/hooks/use-ring-games";
import { useRingGames } from "@/stores/hooks/use-ring-games";

interface UseRingGameTabOptions {
	storeId: string;
}

export function useRingGameTab({ storeId }: UseRingGameTabOptions) {
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingGame, setEditingGame] = useState<RingGame | null>(null);

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

	return {
		showArchived,
		setShowArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingGame,
		setEditingGame,
		activeGames,
		archivedGames,
		currencies,
		activeLoading,
		archivedLoading,
		isCreatePending,
		isUpdatePending,
		archive,
		restore,
		deleteGame,
		handleCreate,
		handleUpdate,
	};
}
