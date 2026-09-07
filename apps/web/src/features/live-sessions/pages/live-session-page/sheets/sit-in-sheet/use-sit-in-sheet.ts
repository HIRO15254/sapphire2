import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { trpc } from "@/utils/trpc";
import type { PlayerPickerCandidate } from "../../player-picker";

export interface SitInCandidate extends PlayerPickerCandidate {
	id: string | null;
}

interface UseSitInSheetOptions {
	excludePlayerIds: readonly string[];
	heroSeatPosition: number | null;
	onSeatExisting: (playerId: string, playerName: string) => void;
	onSeatHero: () => void;
	onSeatNew: (name: string) => void;
	onSeatTemporary: () => void;
	open: boolean;
	seatPosition: number;
}

const NEW_PLAYER_KEY = "new";
const NEW_PLAYER_META = "Create as a new player";
const NO_LABELS_META = "No labels";
const TEMPORARY_KEY = "temporary";
const TEMPORARY_NAME = "Anonymous";
const TEMPORARY_META = "Temporary player — name it later";

export function useSitInSheet({
	excludePlayerIds,
	heroSeatPosition,
	onSeatExisting,
	onSeatHero,
	onSeatNew,
	onSeatTemporary,
	open,
	seatPosition,
}: UseSitInSheetOptions) {
	const [query, setQuery] = useState("");
	const [pickedKey, setPickedKey] = useState<string | null>(null);
	const [heroOverride, setHeroOverride] = useState<boolean | null>(null);

	useEffect(() => {
		if (open) {
			setQuery("");
			setPickedKey(null);
			setHeroOverride(null);
		}
	}, [open]);

	const playersQuery = useQuery({
		...trpc.player.list.queryOptions(),
		enabled: open,
	});

	const trimmed = query.trim();
	const needle = trimmed.toLowerCase();
	const matched = (playersQuery.data ?? [])
		.filter((player) => !excludePlayerIds.includes(player.id))
		.filter(
			(player) => needle === "" || player.name.toLowerCase().includes(needle)
		);
	const hasExactMatch = matched.some(
		(player) => player.name.toLowerCase() === needle
	);

	const candidates: SitInCandidate[] = [
		...(trimmed === ""
			? [
					{
						id: null,
						key: TEMPORARY_KEY,
						kind: "temporary" as const,
						meta: TEMPORARY_META,
						name: TEMPORARY_NAME,
					},
				]
			: []),
		...(trimmed === "" || hasExactMatch
			? []
			: [
					{
						id: null,
						key: NEW_PLAYER_KEY,
						kind: "new" as const,
						meta: NEW_PLAYER_META,
						name: trimmed,
					},
				]),
		...matched.map((player) => ({
			id: player.id,
			key: player.id,
			kind: "existing" as const,
			meta:
				player.tags.length === 0
					? NO_LABELS_META
					: player.tags.map((tag) => tag.name).join(" · "),
			name: player.name,
		})),
	];

	const isHeroSeat = heroOverride ?? heroSeatPosition === seatPosition;
	const picked =
		candidates.find((candidate) => candidate.key === pickedKey) ?? null;

	return {
		candidates,
		isHeroSeat,
		isLoading: playersQuery.isLoading,
		onPick: (candidate: PlayerPickerCandidate) => setPickedKey(candidate.key),
		onQueryChange: (value: string) => {
			setQuery(value);
			setPickedKey(null);
		},
		onSubmit: () => {
			if (isHeroSeat) {
				onSeatHero();
				return;
			}
			if (picked === null) {
				return;
			}
			if (picked.key === TEMPORARY_KEY) {
				onSeatTemporary();
				return;
			}
			if (picked.id === null) {
				onSeatNew(picked.name);
				return;
			}
			onSeatExisting(picked.id, picked.name);
		},
		onToggleHeroSeat: setHeroOverride,
		pickedKey: picked?.key ?? null,
		query,
		seatLabel: `S${seatPosition + 1}`,
	};
}
