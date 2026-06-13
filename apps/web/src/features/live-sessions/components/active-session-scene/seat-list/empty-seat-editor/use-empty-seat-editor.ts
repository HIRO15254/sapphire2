import { useAddPlayerSearch } from "@/features/live-sessions/components/add-player-sheet/use-add-player-search";

interface UseEmptySeatEditorOptions {
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { name: string }) => void;
}

/**
 * Drives the inline empty-seat editor: reuses the add-player search/filter hook
 * (available players show immediately; typing narrows them) and turns the
 * current search text into a "create new" submission. Tags are added after
 * seating via the occupied-seat editor, keeping the seating tap path minimal.
 */
export function useEmptySeatEditor({
	excludePlayerIds,
	onAddExisting,
	onAddNew,
}: UseEmptySeatEditorOptions) {
	const search = useAddPlayerSearch({ excludePlayerIds, open: true });

	return {
		filteredPlayers: search.filteredPlayers,
		handleAddExisting: (playerId: string, playerName: string) => {
			onAddExisting(playerId, playerName);
		},
		handleCreateNew: () => {
			const trimmed = search.search.trim();
			if (!trimmed) {
				return;
			}
			onAddNew({ name: trimmed });
		},
		search: search.search,
		setSearch: search.setSearch,
	};
}
