import type { PlayerFormValues } from "@/features/players/components/player-form";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";

interface UseOccupiedSeatEditorOptions {
	onSaved: () => void;
	playerId: string;
}

/**
 * Loads the seated player's detail (memo / tags) and persists inline edits.
 * Used by the occupied-seat row when it is expanded for editing — no modal.
 */
export function useOccupiedSeatEditor({
	onSaved,
	playerId,
}: UseOccupiedSeatEditorOptions) {
	const { availableTags, createTag, isSaving, player, updatePlayer } =
		usePlayerDetail(playerId);

	return {
		availableTags,
		createTag,
		isSaving,
		onSubmit: (values: PlayerFormValues) => {
			updatePlayer({
				id: playerId,
				memo: values.memo,
				name: values.name,
				tagIds: values.tagIds,
			});
			onSaved();
		},
		player,
	};
}
