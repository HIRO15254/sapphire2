import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/utils/trpc";

interface PlayerOption {
	id: string;
	memo: string | null;
	name: string;
	tags: { color: string; id: string; name: string }[];
}

interface UseEmptySeatEditorOptions {
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { name: string }) => void;
	onAddTemporary: () => void;
	onSeatHero: () => void;
}

/**
 * Drives the always-on empty-seat combobox: fetches the full player catalog
 * (shared cache key — no extra request) and filters it client-side by player
 * name OR tag name so a single text field searches both. Hero and temporary
 * seating are quick-action icons beside the field; the dropdown handles
 * existing-player selection and create-by-name.
 */
export function useEmptySeatEditor({
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onAddTemporary,
	onSeatHero,
}: UseEmptySeatEditorOptions) {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (open && anchorRef.current) {
			setContentWidth(anchorRef.current.offsetWidth);
		}
	}, [open]);

	const playersQuery = useQuery(trpc.player.list.queryOptions());
	const excludeSet = new Set(excludePlayerIds);
	const normalized = query.trim().toLowerCase();
	const matches = ((playersQuery.data ?? []) as PlayerOption[]).filter(
		(p) =>
			!excludeSet.has(p.id) &&
			(normalized === "" ||
				p.name.toLowerCase().includes(normalized) ||
				p.tags.some((tag) => tag.name.toLowerCase().includes(normalized)))
	);
	const trimmed = query.trim();

	const reset = () => {
		setQuery("");
		setOpen(false);
	};

	return {
		anchorRef,
		canCreate: trimmed.length > 0,
		contentWidth,
		matches,
		onCreate: () => {
			if (!trimmed) {
				return;
			}
			onAddNew({ name: trimmed });
			reset();
		},
		onHero: () => {
			onSeatHero();
			reset();
		},
		onSelectExisting: (player: PlayerOption) => {
			onAddExisting(player.id, player.name);
			reset();
		},
		onTemporary: () => {
			onAddTemporary();
			reset();
		},
		open,
		query,
		setOpen,
		setQuery,
		trimmed,
	};
}
