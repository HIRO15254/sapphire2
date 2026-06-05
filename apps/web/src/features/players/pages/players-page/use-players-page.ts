import { useState } from "react";
import type { PlayerFormValues } from "@/features/players/components/player-form";
import { usePlayers } from "@/features/players/hooks/use-players";

export function usePlayersPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

	const {
		players,
		availableTags,
		isLoading,
		isCreatePending,
		create,
		createTag,
	} = usePlayers(filterTagIds);

	const handleCreate = (values: PlayerFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	const toggleFilterTag = (tagId: string) => {
		setFilterTagIds((prev) =>
			prev.includes(tagId)
				? prev.filter((id) => id !== tagId)
				: [...prev, tagId]
		);
	};

	return {
		players,
		availableTags,
		isLoading,
		isCreateOpen,
		isCreatePending,
		filterTagIds,
		setIsCreateOpen,
		toggleFilterTag,
		handleCreate,
		createTag,
	};
}
