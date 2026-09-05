import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { trpc } from "@/utils/trpc";

export interface JoinSeatPlayerOption {
	id: string;
	memo: string | null;
	name: string;
	tags: { color: string; id: string; name: string }[];
}

interface UseJoinSeatSheetOptions {
	excludePlayerIds: string[];
	onOpenChange: (open: boolean) => void;
	onScan: () => void;
	onSeatExisting: (
		seatPosition: number,
		playerId: string,
		playerName: string
	) => void;
	onSeatHero: (seatPosition: number) => void;
	onSeatNew: (
		seatPosition: number,
		values: { memo?: string | null; name: string; tagIds?: string[] }
	) => void;
	onSeatTemporary: (seatPosition: number) => void;
	seatPosition: number | null;
}

export function useJoinSeatSheet({
	excludePlayerIds,
	onOpenChange,
	onScan,
	onSeatExisting,
	onSeatHero,
	onSeatNew,
	onSeatTemporary,
	seatPosition,
}: UseJoinSeatSheetOptions) {
	const [query, setQuery] = useState("");

	const playersQuery = useQuery(trpc.player.list.queryOptions());
	const excludeSet = new Set(excludePlayerIds);
	const normalizedQuery = query.trim().toLowerCase();
	const trimmedQuery = query.trim();
	const matches = ((playersQuery.data ?? []) as JoinSeatPlayerOption[]).filter(
		(p) =>
			!excludeSet.has(p.id) &&
			(normalizedQuery === "" ||
				p.name.toLowerCase().includes(normalizedQuery) ||
				p.tags.some((tag) => tag.name.toLowerCase().includes(normalizedQuery)))
	);
	const hasExactMatch = matches.some(
		(p) => p.name.trim().toLowerCase() === normalizedQuery
	);

	const closeSheet = () => {
		setQuery("");
		onOpenChange(false);
	};

	return {
		clearQuery: () => setQuery(""),
		hasQuery: trimmedQuery.length > 0,
		matches,
		onCreate: () => {
			if (!(trimmedQuery && seatPosition !== null)) {
				return;
			}
			onSeatNew(seatPosition, { name: trimmedQuery });
			closeSheet();
		},
		onTemporary: () => {
			if (seatPosition === null) {
				return;
			}
			onSeatTemporary(seatPosition);
			closeSheet();
		},
		onScanClick: () => {
			onScan();
			closeSheet();
		},
		onSelectExisting: (player: JoinSeatPlayerOption) => {
			if (seatPosition === null) {
				return;
			}
			onSeatExisting(seatPosition, player.id, player.name);
			closeSheet();
		},
		onToggleHero: (checked: boolean) => {
			if (!(checked && seatPosition !== null)) {
				return;
			}
			onSeatHero(seatPosition);
			closeSheet();
		},
		query,
		setQuery,
		showCreateOption: trimmedQuery.length > 0 && !hasExactMatch,
		title: seatPosition === null ? "Sit in" : `Sit in at S${seatPosition + 1}`,
		trimmedQuery,
	};
}
