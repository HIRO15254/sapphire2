import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import type { MixGameGroup } from "@sapphire2/db/schemas/game";
import { useEffect, useState } from "react";
import { describeMixStakesLine } from "@/features/live-sessions/utils/mix-composition";
import { useGameGroups } from "@/shared/hooks/use-game-groups";

export type GameTypeMode = "mixed" | "single";

const MODES: { key: GameTypeMode; label: string }[] = [
	{ key: "single", label: "Single game" },
	{ key: "mixed", label: "Mixed game" },
];

function normalized(value: string): string {
	return value.trim().toLowerCase();
}

interface UseGameTypeSheetOptions {
	mixGames: MixGameGroup[] | null;
	open: boolean;
	variant: string;
}

export function useGameTypeSheet({
	mixGames,
	open,
	variant,
}: UseGameTypeSheetOptions) {
	const { groupFor, isMixValue, mixCompositionLabels, mixes, variants } =
		useGameGroups();
	const isMix = isMixValue(variant);
	const [mode, setMode] = useState<GameTypeMode>(isMix ? "mixed" : "single");

	useEffect(() => {
		if (open) {
			setMode(isMix ? "mixed" : "single");
		}
	}, [open, isMix]);

	const shortLabelByLabel = new Map(
		variants.map((row) => [normalized(row.label), row.shortLabel ?? row.label])
	);
	const presets = mixes.map((mix) => ({
		games: mixCompositionLabels(mix.label)
			.map((label) => shortLabelByLabel.get(normalized(label)) ?? label)
			.join(" · "),
		label: mix.label,
	}));

	const isCustomMix = normalized(variant) === MIX_VARIANT;
	const selectedMix = isCustomMix
		? MIX_VARIANT
		: (presets.find(
				(preset) => normalized(preset.label) === normalized(variant)
			)?.label ?? "");

	return {
		customDescription:
			isCustomMix && mixGames !== null && mixGames.length > 0
				? describeMixStakesLine(mixGames, groupFor)
				: "Build your own groups",
		isMix,
		isPicked: (label: string) => normalized(label) === normalized(variant),
		mode,
		modes: MODES.map((entry) => ({ ...entry, isActive: entry.key === mode })),
		onSelectMode: setMode,
		presets,
		selectedMix,
	};
}
