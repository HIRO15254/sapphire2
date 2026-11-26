import { type ChangeEvent, useState } from "react";
import type {
	GameGroup,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import { isActive, MAX_MIX_GAMES } from "@/features/games/utils/game-masters";

const OPEN_BY_DEFAULT_UP_TO = 24;

interface UseGamesPickerOptions {
	groups: GameGroup[] | undefined;
	onChange: (next: string[]) => void;
	onOpenChange: (open: boolean) => void;
	value: string[];
	variants: GameVariant[];
}

export function useGamesPicker({
	groups,
	onChange,
	onOpenChange,
	value,
	variants,
}: UseGamesPickerOptions) {
	const [query, setQuery] = useState("");
	const [expanded, setExpanded] = useState<Record<string, boolean> | null>(
		null
	);
	const active = variants.filter(isActive);
	const openByDefault = active.length <= OPEN_BY_DEFAULT_UP_TO;
	const needle = query.trim().toLowerCase();
	const picked = new Set(value);
	const owners = groups
		? groups.filter(isActive).map((group) => ({
				id: group.id,
				title: group.label,
				variants: active.filter((variant) => variant.groupId === group.id),
			}))
		: [{ id: "all", title: "All games", variants: active }];
	const isOpen = (id: string) =>
		needle ? true : (expanded?.[id] ?? openByDefault);

	const sections = owners
		.map((owner) => {
			const pickedCount = owner.variants.filter((variant) =>
				picked.has(variant.id)
			).length;
			const open = isOpen(owner.id);
			return {
				allChecked:
					owner.variants.length > 0 && pickedCount === owner.variants.length,
				count: `${pickedCount} of ${owner.variants.length}`,
				id: owner.id,
				ids: owner.variants.map((variant) => variant.id),
				open,
				rows: owner.variants
					.filter(
						(variant) =>
							!needle ||
							variant.label.toLowerCase().includes(needle) ||
							(variant.shortLabel ?? "").toLowerCase().includes(needle)
					)
					.map((variant) => ({
						checked: picked.has(variant.id),
						id: variant.id,
						label: variant.label,
						short: variant.shortLabel ?? "",
					})),
				title: owner.title,
			};
		})
		.filter((section) => section.rows.length > 0);

	return {
		countText: `${value.length} of ${MAX_MIX_GAMES} picked`,
		onOpenChange: (open: boolean) => {
			if (!open) {
				setQuery("");
				setExpanded(null);
			}
			onOpenChange(open);
		},
		onQueryChange: (event: ChangeEvent<HTMLInputElement>) =>
			setQuery(event.target.value),
		onToggleAll: (ids: string[]) => (checked: boolean) => {
			const rest = value.filter((id) => !ids.includes(id));
			onChange(checked ? [...rest, ...ids] : rest);
		},
		onToggleGame: (id: string) => (checked: boolean) => {
			const rest = value.filter((other) => other !== id);
			onChange(checked ? [...rest, id] : rest);
		},
		onToggleOpen: (id: string) => () => {
			const current = Object.fromEntries(
				owners.map((owner) => [owner.id, isOpen(owner.id)])
			);
			setExpanded({ ...current, [id]: !isOpen(id) });
		},
		query,
		sections,
	};
}
