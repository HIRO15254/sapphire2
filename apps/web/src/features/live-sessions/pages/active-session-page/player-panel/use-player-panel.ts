import type { FocusEvent } from "react";
import { useRef } from "react";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";
import { usePlayerDetail } from "@/features/players/hooks/use-player-detail";

export interface PlayerPanelSelection {
	playerId: string;
	playerName: string;
	seatPosition: number;
}

interface UsePlayerPanelOptions {
	onLeave: (selection: PlayerPanelSelection) => void;
	selection: PlayerPanelSelection | null;
}

export function usePlayerPanel({ onLeave, selection }: UsePlayerPanelOptions) {
	const playerId = selection?.playerId ?? null;
	const { availableTags, createTag, isSaving, player, updatePlayer } =
		usePlayerDetail(playerId);
	const memoDraft = useRef<string | null>(null);

	const currentTagIds = () => player?.tags.map((tag) => tag.id) ?? [];

	const onAddTag = (tag: PlayerTagWithColor) => {
		if (!(player && playerId) || player.tags.some((t) => t.id === tag.id)) {
			return;
		}
		updatePlayer({ id: playerId, tagIds: [...currentTagIds(), tag.id] });
	};

	const onRemoveTag = (tag: PlayerTagWithColor) => {
		if (!(player && playerId)) {
			return;
		}
		updatePlayer({
			id: playerId,
			tagIds: currentTagIds().filter((id) => id !== tag.id),
		});
	};

	const onNameBlur = (value: string) => {
		const trimmed = value.trim();
		if (!(trimmed && player && playerId) || trimmed === player.name) {
			return;
		}
		updatePlayer({ id: playerId, name: trimmed });
	};

	const onMemoChange = (html: string) => {
		memoDraft.current = html;
	};

	const onMemoBlur = () => {
		const draft = memoDraft.current;
		if (
			draft === null ||
			!(player && playerId) ||
			draft === (player.memo ?? "")
		) {
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

	const onLeaveClick = () => {
		if (!selection) {
			return;
		}
		onLeave(selection);
	};

	return {
		availableTags,
		createTag,
		isSaving,
		onAddTag,
		onLeaveClick,
		onMemoBlur,
		onMemoChange,
		onMemoContainerBlur,
		onNameBlur,
		onRemoveTag,
		player,
		seatLabel: selection ? `S${selection.seatPosition + 1}` : null,
	};
}
