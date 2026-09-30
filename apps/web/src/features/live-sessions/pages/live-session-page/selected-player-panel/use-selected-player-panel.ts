import { memoExcerpt } from "@/features/live-sessions/utils/memo-excerpt";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";

interface UseSelectedPlayerPanelOptions {
	onLeave: (playerId: string) => void;
	playerId: string;
}

export function useSelectedPlayerPanel({
	onLeave,
	playerId,
}: UseSelectedPlayerPanelOptions) {
	const { availableTags, createTag, isSaving, player, updatePlayer } =
		usePlayerDetail(playerId);

	const selectedTags = player?.tags ?? [];
	const selectedTagIds = selectedTags.map((tag) => tag.id);

	return {
		availableTags,
		isSaving,
		notesText: memoExcerpt(player?.memo ?? null) ?? "",
		onAddTag: (tag: PlayerTagWithColor) => {
			if (selectedTagIds.includes(tag.id)) {
				return;
			}
			updatePlayer({ id: playerId, tagIds: [...selectedTagIds, tag.id] });
		},
		onCreateTag: createTag,
		onLeave: () => onLeave(playerId),
		onNameCommit: (value: string) => {
			const trimmed = value.trim();
			if (!(trimmed && player) || trimmed === player.name) {
				return;
			}
			updatePlayer({ id: playerId, name: trimmed });
		},
		onNotesCommit: (value: string) => {
			if (!player) {
				return;
			}
			const current = memoExcerpt(player.memo ?? null) ?? "";
			if (value === current) {
				return;
			}
			updatePlayer({ id: playerId, memo: value === "" ? null : value });
		},
		onRemoveTag: (tag: PlayerTagWithColor) => {
			updatePlayer({
				id: playerId,
				tagIds: selectedTagIds.filter((id) => id !== tag.id),
			});
		},
		player,
		selectedTags,
	};
}
