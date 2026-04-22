import { useState } from "react";
import type { PlayerFormValues } from "@/players/components/player-form";
import type { PlayerItem } from "@/players/hooks/use-players";
import { usePlayers } from "@/players/hooks/use-players";

export function usePlayersPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingPlayer, setEditingPlayer] = useState<PlayerItem | null>(null);
	const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
	const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

	const {
		players,
		availableTags,
		isCreatePending,
		isUpdatePending,
		create,
		update,
		delete: deletePlayer,
		createTag,
	} = usePlayers(filterTagIds);

	const handleCreate = (values: PlayerFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const handleUpdate = (values: PlayerFormValues) => {
		if (!editingPlayer) {
			return;
		}
		update({ id: editingPlayer.id, ...values }).then(() => {
			setEditingPlayer(null);
		});
	};

	const handleDelete = (id: string) => {
		deletePlayer(id);
	};

	const handleOpenEdit = (player: PlayerItem) => {
		setEditingPlayer({ ...player, isTemporary: false });
	};

	const handleCloseEdit = () => {
		setEditingPlayer(null);
	};

	return {
		players,
		availableTags,
		isCreatePending,
		isUpdatePending,
		isCreateOpen,
		editingPlayer,
		isTagManagerOpen,
		filterTagIds,
		setIsCreateOpen,
		setIsTagManagerOpen,
		setFilterTagIds,
		handleCreate,
		handleUpdate,
		handleDelete,
		handleOpenEdit,
		handleCloseEdit,
		createTag,
	};
}
