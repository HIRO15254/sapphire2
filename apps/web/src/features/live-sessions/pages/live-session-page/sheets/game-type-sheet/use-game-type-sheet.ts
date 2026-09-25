import { MIX_VARIANT } from "@sapphire2/db/constants/game-variants";
import { useEffect, useState } from "react";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import type { GameMasterRow } from "../game-master-sheet";
import type { MixMasterRow, SavedMix } from "../mix-master-sheet";

export type GameTypeMode = "mixed" | "single";

export type GameTypeTarget =
	| { isCash: boolean; kind: "session"; variant: string }
	| { kind: "level"; levelNumber: number; selection: string };

export interface PickedMix {
	games: string[];
	label: string;
}

const MODES: { key: GameTypeMode; label: string }[] = [
	{ key: "single", label: "Single game" },
	{ key: "mixed", label: "Mixed game" },
];

function normalized(value: string): string {
	return value.trim().toLowerCase();
}

function mixedHint(target: GameTypeTarget): string {
	if (target.kind === "level") {
		return "Each group's stakes are set on this level's row in the Blinds tab.";
	}
	return target.isCash
		? "Games in a mix are grouped by blind structure. Each group's stakes are set in Basics."
		: "Games and stakes for each level are set in the Blinds tab.";
}

interface MasterSheetState<T> {
	editing: T | null;
	open: boolean;
}

const CLOSED = { editing: null, open: false };

interface UseGameTypeSheetOptions {
	onPickMix: (mix: PickedMix) => void;
	onPickVariant: (label: string) => void;
	open: boolean;
	target: GameTypeTarget;
}

export function useGameTypeSheet({
	onPickMix,
	onPickVariant,
	open,
	target,
}: UseGameTypeSheetOptions) {
	const { isMixValue, mixCompositionLabels, mixes, variants } = useGameGroups();
	const selection =
		target.kind === "session" ? target.variant : target.selection;
	const isMix = isMixValue(selection);
	const [mode, setMode] = useState<GameTypeMode>(isMix ? "mixed" : "single");
	const [gameSheet, setGameSheet] =
		useState<MasterSheetState<GameMasterRow>>(CLOSED);
	const [mixSheet, setMixSheet] =
		useState<MasterSheetState<MixMasterRow>>(CLOSED);

	useEffect(() => {
		if (open) {
			setMode(isMix ? "mixed" : "single");
			setGameSheet(CLOSED);
			setMixSheet(CLOSED);
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

	const selectedVariant = variants.find(
		(row) => normalized(row.label) === normalized(selection)
	);
	const selectedMix = mixes.find(
		(mix) => normalized(mix.label) === normalized(selection)
	);

	return {
		clearLabel:
			target.kind === "level" && selection !== "" ? "Use session game" : null,
		gameSheet: {
			...gameSheet,
			onOpenChange: (next: boolean) =>
				setGameSheet((current) => ({ ...current, open: next })),
			onSaved: onPickVariant,
		},
		isCustomMix: normalized(selection) === MIX_VARIANT,
		isPicked: (label: string) => normalized(label) === normalized(selection),
		mixedHint: mixedHint(target),
		mixSheet: {
			...mixSheet,
			onOpenChange: (next: boolean) =>
				setMixSheet((current) => ({ ...current, open: next })),
			onSaved: (saved: SavedMix) => onPickMix(saved),
		},
		mode,
		modes: MODES.map((entry) => ({ ...entry, isActive: entry.key === mode })),
		onEditGame: selectedVariant
			? () =>
					setGameSheet({
						editing: {
							groupId: selectedVariant.groupId,
							id: selectedVariant.id,
							label: selectedVariant.label,
							shortLabel: selectedVariant.shortLabel,
						},
						open: true,
					})
			: null,
		onEditMix: selectedMix
			? () =>
					setMixSheet({
						editing: {
							games: [...selectedMix.games],
							id: selectedMix.id,
							label: selectedMix.label,
						},
						open: true,
					})
			: null,
		onNewGame: () => setGameSheet({ editing: null, open: true }),
		onNewMix: () => setMixSheet({ editing: null, open: true }),
		onPickPreset: (label: string) =>
			onPickMix({ games: mixCompositionLabels(label), label }),
		onSelectMode: setMode,
		presets,
		selectedMix: selectedMix?.label ?? "",
		title:
			target.kind === "level"
				? `Level ${target.levelNumber} games`
				: "Select game type",
	};
}
