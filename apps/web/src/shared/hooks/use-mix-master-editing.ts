import { useState } from "react";
import {
	type MixGameGroupRow,
	type ResolveGroup,
	reseedFromLabels,
} from "@/shared/lib/mix-games";

export interface MixMasterRow {
	builtinKey: string | null;
	games: string[];
	id: string;
	label: string;
}

interface VariantRowLike {
	id: string;
	label: string;
}

interface UseMixMasterEditingArgs {
	getRows: () => MixGameGroupRow[];
	groupFor: ResolveGroup;
	mixes: MixMasterRow[];
	onVariantLabelChange: (label: string) => void;
	setRows: (rows: MixGameGroupRow[]) => void;
	variants: VariantRowLike[];
}

export function useMixMasterEditing({
	getRows,
	groupFor,
	mixes,
	onVariantLabelChange,
	setRows,
	variants,
}: UseMixMasterEditingArgs) {
	const [editingMix, setEditingMix] = useState<MixMasterRow | null>(null);
	const [isMixSheetOpen, setIsMixSheetOpen] = useState(false);

	const mixRowFor = (variantLabel: string): MixMasterRow | null => {
		const normalized = variantLabel.trim().toLowerCase();
		return (
			mixes.find((m) => m.label.trim().toLowerCase() === normalized) ?? null
		);
	};

	const onEditMix = (variantLabel: string) => {
		const row = mixRowFor(variantLabel);
		if (!row) {
			return;
		}
		setEditingMix(row);
		setIsMixSheetOpen(true);
	};

	const onMixSaved = (
		mix: { games: string[]; id: string; label: string },
		gameLabels?: string[]
	) => {
		const labelById = new Map(variants.map((v) => [v.id, v.label]));
		const labels =
			gameLabels ??
			mix.games
				.map((id) => labelById.get(id))
				.filter((label): label is string => label !== undefined);
		onVariantLabelChange(mix.label);
		setRows(reseedFromLabels(getRows(), labels, groupFor));
		setIsMixSheetOpen(false);
	};

	return {
		editingMix,
		isMixSheetOpen,
		mixRowFor,
		onEditMix,
		onMixSaved,
		setIsMixSheetOpen,
	};
}
