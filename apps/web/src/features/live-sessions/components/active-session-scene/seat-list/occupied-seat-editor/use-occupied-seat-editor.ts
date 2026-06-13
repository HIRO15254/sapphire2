import type { FocusEvent } from "react";
import { useRef, useState } from "react";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";

interface UseOccupiedSeatEditorOptions {
	playerId: string;
}

/**
 * Speed-first inline editing of a seated player: tag chips toggle-save on tap,
 * name and memo auto-save on blur — no Save button, every write optimistic via
 * `usePlayerDetail.updatePlayer`.
 */
export function useOccupiedSeatEditor({
	playerId,
}: UseOccupiedSeatEditorOptions) {
	const { availableTags, createTag, isSaving, player, updatePlayer } =
		usePlayerDetail(playerId);
	const [newTagName, setNewTagName] = useState("");
	// Latest memo html from the editor; null = untouched this session.
	const memoDraft = useRef<string | null>(null);

	const selectedTagIds = new Set(player?.tags.map((tag) => tag.id) ?? []);

	const onToggleTag = (tagId: string) => {
		if (!player) {
			return;
		}
		const tagIds = selectedTagIds.has(tagId)
			? player.tags.filter((tag) => tag.id !== tagId).map((tag) => tag.id)
			: [...player.tags.map((tag) => tag.id), tagId];
		updatePlayer({ id: playerId, tagIds });
	};

	const onCreateTag = async () => {
		const trimmed = newTagName.trim();
		if (!(trimmed && player)) {
			return;
		}
		const created = await createTag(trimmed);
		updatePlayer({
			id: playerId,
			tagIds: [...player.tags.map((tag) => tag.id), created.id],
		});
		setNewTagName("");
	};

	const onNameBlur = (value: string) => {
		const trimmed = value.trim();
		if (!(trimmed && player) || trimmed === player.name) {
			return;
		}
		updatePlayer({ id: playerId, name: trimmed });
	};

	const onMemoChange = (html: string) => {
		memoDraft.current = html;
	};

	const onMemoBlur = () => {
		const draft = memoDraft.current;
		if (draft === null || !player || draft === (player.memo ?? "")) {
			return;
		}
		updatePlayer({ id: playerId, memo: draft === "" ? null : draft });
	};

	/** Saves only when focus actually leaves the memo editor (not toolbar taps). */
	const onMemoContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
			return;
		}
		onMemoBlur();
	};

	return {
		availableTags,
		isSaving,
		isTagSelected: (tagId: string) => selectedTagIds.has(tagId),
		newTagName,
		onCreateTag,
		onMemoBlur,
		onMemoChange,
		onMemoContainerBlur,
		onNameBlur,
		onToggleTag,
		player,
		setNewTagName,
	};
}
