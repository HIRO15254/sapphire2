import { useState } from "react";
import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import {
	countLabel,
	isActive,
	mixSummary,
} from "@/features/games/utils/game-masters";
import type { GameChoice } from "@/features/games/utils/stakes";

export type PickerTab = "games" | "mixes";

export interface UseGamePickerOptions {
	groups: GameGroup[] | undefined;
	mixes: GameMix[] | undefined;
	onOpenChange: (open: boolean) => void;
	onPick: (choice: GameChoice) => void;
	value: GameChoice | null;
	variants: GameVariant[] | undefined;
}

function initialTab(value: GameChoice | null): PickerTab {
	return value && "gameMixId" in value ? "mixes" : "games";
}

export function useGamePicker({
	groups,
	mixes,
	onOpenChange,
	onPick,
	value,
	variants,
}: UseGamePickerOptions) {
	const [tab, setTab] = useState<PickerTab>(() => initialTab(value));
	const selectedVariant =
		value && "variantId" in value ? value.variantId : null;
	const selectedMix = value && "gameMixId" in value ? value.gameMixId : null;
	const activeVariants = (variants ?? []).filter(isActive);

	const close = (next: GameChoice | null) => {
		setTab(initialTab(next));
		onOpenChange(false);
	};
	const pick = (choice: GameChoice) => () => {
		onPick(choice);
		close(choice);
	};

	const variantRow = (variant: GameVariant) => ({
		id: variant.id,
		label: variant.label,
		onPick: pick({ variantId: variant.id }),
		selected: variant.id === selectedVariant,
		short: variant.shortLabel ?? "",
		sub: null,
	});
	const gameSections = groups
		? groups.filter(isActive).map((group) => ({
				id: group.id,
				rows: activeVariants
					.filter((variant) => variant.groupId === group.id)
					.map(variantRow),
				title: group.label,
			}))
		: [{ id: "all", rows: activeVariants.map(variantRow), title: "All games" }];
	const mixSection = {
		id: "mixes",
		rows: (mixes ?? []).filter(isActive).map((mix) => ({
			id: mix.id,
			label: mix.label,
			onPick: pick({ gameMixId: mix.id }),
			selected: mix.id === selectedMix,
			short: countLabel(mix.games.length, "game"),
			sub: mixSummary(mix, variants, groups),
		})),
		title: "Mixes",
	};

	return {
		emptyText: tab === "games" ? "No games" : "No mixes",
		onOpenChange: (open: boolean) => {
			if (!open) {
				close(value);
			}
		},
		onTabChange: (next: string) => {
			if (next === "games" || next === "mixes") {
				setTab(next);
			}
		},
		sections: (tab === "games" ? gameSections : [mixSection]).filter(
			(section) => section.rows.length > 0
		),
		tab,
	};
}
