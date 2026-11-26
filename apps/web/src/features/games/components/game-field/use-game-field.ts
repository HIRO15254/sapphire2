import { useId, useState } from "react";
import type {
	GameGroup,
	GameMix,
	GameVariant,
} from "@/features/games/hooks/use-game-masters";
import { countLabel } from "@/features/games/utils/game-masters";
import type { GameChoice, LineupShape } from "@/features/games/utils/stakes";

export interface UseGameFieldOptions {
	groups: GameGroup[] | undefined;
	lineup?: (LineupShape & { displayName: string }) | null;
	mixes: GameMix[] | undefined;
	onChange: (choice: GameChoice) => void;
	value: GameChoice | null;
	variants: GameVariant[] | undefined;
}

interface GameDisplay {
	isMix: boolean;
	label: string;
	meta: string;
}

function displayOf({
	lineup,
	mixes,
	value,
	variants,
}: Pick<
	UseGameFieldOptions,
	"lineup" | "mixes" | "value" | "variants"
>): GameDisplay | null {
	if (!value) {
		return null;
	}
	if ("variantId" in value) {
		const variant = variants?.find((row) => row.id === value.variantId);
		return variant
			? { isMix: false, label: variant.label, meta: variant.shortLabel ?? "" }
			: null;
	}
	if ("gameMixId" in value) {
		const mix = mixes?.find((row) => row.id === value.gameMixId);
		return mix
			? {
					isMix: true,
					label: mix.label,
					meta: countLabel(mix.games.length, "game"),
				}
			: null;
	}
	if (!lineup) {
		return null;
	}
	const games = lineup.groups.flatMap((group) => group.variants).length;
	return {
		isMix: games > 1,
		label: lineup.displayName,
		meta: games > 1 ? countLabel(games, "game") : "",
	};
}

export function useGameField({
	groups,
	lineup,
	mixes,
	onChange,
	value,
	variants,
}: UseGameFieldOptions) {
	const id = useId();
	const [isPickerOpen, setPickerOpen] = useState(false);
	const display = displayOf({ lineup, mixes, value, variants });

	return {
		buttonLabel: display ? `Game: ${display.label}. Change` : "Game: Choose",
		display,
		id,
		isPickerOpen,
		onOpenPicker: () => setPickerOpen(true),
		picker: {
			groups,
			mixes,
			onOpenChange: setPickerOpen,
			onPick: onChange,
			value,
			variants,
		},
	};
}
