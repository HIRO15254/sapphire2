import type { FocusEvent } from "react";
import { useRef } from "react";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";

interface UseOccupiedSeatEditorOptions {
	playerId: string;
}

export function useOccupiedSeatEditor({
	playerId,
}: UseOccupiedSeatEditorOptions) {
	const { availableTags, createTag, isSaving, player, updatePlayer } =
		usePlayerDetail(playerId);
	const memoDraft = useRef<string | null>(null);

	const currentTagIds = () => player?.tags.map((tag) => tag.id) ?? [];

	const onAddTag = (tag: PlayerTagWithColor) => {
		if (!player || player.tags.some((t) => t.id === tag.id)) {
			return;
		}
		updatePlayer({ id: playerId, tagIds: [...currentTagIds(), tag.id] });
	};

	const onRemoveTag = (tag: PlayerTagWithColor) => {
		if (!player) {
			return;
		}
		updatePlayer({
			id: playerId,
			tagIds: currentTagIds().filter((id) => id !== tag.id),
		});
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

	const onMemoContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
			return;
		}
		onMemoBlur();
	};

	return {
		availableTags,
		createTag,
		isSaving,
		onAddTag,
		onMemoBlur,
		onMemoChange,
		onMemoContainerBlur,
		onNameBlur,
		onRemoveTag,
		player,
	};
}
