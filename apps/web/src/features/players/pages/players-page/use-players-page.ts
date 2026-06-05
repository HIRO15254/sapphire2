import { useState } from "react";
import type { PlayerFormValues } from "@/features/players/components/player-form";
import { usePlayers } from "@/features/players/hooks/use-players";

// The list is fully loaded client-side, so search filters the fetched players
// rather than re-querying — no server `tagIds` filter is needed.
const NO_TAG_FILTER: string[] = [];

export function usePlayersPage() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [search, setSearch] = useState("");

	const {
		players,
		availableTags,
		isLoading,
		isCreatePending,
		create,
		createTag,
	} = usePlayers(NO_TAG_FILTER);

	const normalizedSearch = search.trim().toLowerCase();
	const filteredPlayers = normalizedSearch
		? players.filter(
				(player) =>
					player.name.toLowerCase().includes(normalizedSearch) ||
					player.tags.some((tag) =>
						tag.name.toLowerCase().includes(normalizedSearch)
					)
			)
		: players;

	const handleCreate = (values: PlayerFormValues) => {
		create(values).then(() => {
			setIsCreateOpen(false);
		});
	};

	return {
		players: filteredPlayers,
		availableTags,
		isLoading,
		isCreateOpen,
		isCreatePending,
		search,
		isSearching: normalizedSearch.length > 0,
		setIsCreateOpen,
		setSearch,
		handleCreate,
		createTag,
	};
}
