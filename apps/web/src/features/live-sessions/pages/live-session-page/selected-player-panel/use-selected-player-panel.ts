import { useState } from "react";
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
	const [tagQuery, setTagQuery] = useState("");
	const [isTagListOpen, setIsTagListOpen] = useState(false);

	const selectedTags = player?.tags ?? [];
	const selectedTagIds = selectedTags.map((tag) => tag.id);
	const query = tagQuery.trim().toLowerCase();
	const tagChoices = availableTags.filter(
		(tag) =>
			!selectedTagIds.includes(tag.id) &&
			(query === "" || tag.name.toLowerCase().includes(query))
	);

	const addTag = (tag: PlayerTagWithColor) => {
		if (selectedTagIds.includes(tag.id)) {
			return;
		}
		updatePlayer({ id: playerId, tagIds: [...selectedTagIds, tag.id] });
		setTagQuery("");
	};

	const newTagName = tagQuery.trim();
	const hasExactTag = availableTags.some(
		(tag) => tag.name.toLowerCase() === newTagName.toLowerCase()
	);

	const onCreateTag = async () => {
		if (newTagName === "" || hasExactTag) {
			return;
		}
		addTag(await createTag(newTagName));
	};

	return {
		isSaving,
		isTagListOpen,
		newTagName: newTagName === "" || hasExactTag ? null : newTagName,
		notesText: memoExcerpt(player?.memo ?? null) ?? "",
		onAddTag: addTag,
		onCloseTagList: () => {
			setIsTagListOpen(false);
			setTagQuery("");
		},
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
		onOpenTagList: () => setIsTagListOpen(true),
		onRemoveTag: (tag: PlayerTagWithColor) => {
			updatePlayer({
				id: playerId,
				tagIds: selectedTagIds.filter((id) => id !== tag.id),
			});
		},
		onCreateTag,
		onTagQueryChange: (value: string) => {
			setTagQuery(value);
			setIsTagListOpen(true);
		},
		player,
		selectedTags,
		tagChoices,
		tagQuery,
	};
}
