import { useAddPlayerSearch } from "@/features/live-sessions/components/add-player-sheet/use-add-player-search";

interface UseEmptySeatEditorOptions {
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { name: string; tagIds?: string[] }) => void;
}

/**
 * Drives the inline empty-seat editor: reuses the add-player search/filter hook
 * and turns the current search + tag selection into a "create new" submission.
 */
export function useEmptySeatEditor({
	excludePlayerIds,
	onAddExisting,
	onAddNew,
}: UseEmptySeatEditorOptions) {
	const search = useAddPlayerSearch({ excludePlayerIds, open: true });

	return {
		...search,
		handleAddExisting: (playerId: string, playerName: string) => {
			onAddExisting(playerId, playerName);
		},
		handleCreateNew: () => {
			const trimmed = search.search.trim();
			if (!trimmed) {
				return;
			}
			onAddNew({
				name: trimmed,
				tagIds:
					search.selectedTagIds.length > 0 ? search.selectedTagIds : undefined,
			});
		},
	};
}
