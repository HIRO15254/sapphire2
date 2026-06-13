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
}

/**
 * Drives the always-on empty-seat combobox: fetches the full player catalog
 * (shared cache key — no extra request) and filters it client-side by player
 * name OR tag name so a single text field searches both. The dropdown lets the
 * user seat an existing player, create one by name, or seat a temporary player.
 */
export function useEmptySeatEditor({
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onAddTemporary,
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
			setQuery("");
			setOpen(false);
		},
		onSelectExisting: (player: PlayerOption) => {
			onAddExisting(player.id, player.name);
			setQuery("");
			setOpen(false);
		},
		onTemporary: () => {
			onAddTemporary();
			setQuery("");
			setOpen(false);
		},
		open,
		query,
		setOpen,
		setQuery,
		trimmed,
	};
}
