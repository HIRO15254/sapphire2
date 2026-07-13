import { useState } from "react";
import {
	type MixGameGroupRow,
	type ResolveGroup,
	reseedFromLabels,
} from "@/shared/lib/mix-games";

/** A gameMix.list row — the master behind a frozen mix variant label. */
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
	/**
	 * Fresh editor rows at save time. A getter (not a snapshot) because the
	 * ring-game form keeps the rows inside its tanstack form store, which
	 * does not re-render this hook on field changes.
	 */
	getRows: () => MixGameGroupRow[];
	/** variant label → owning group; from useGameGroups at the call site. */
	groupFor: ResolveGroup;
	mixes: MixMasterRow[];
	/** Applies the (possibly renamed) master label to the form's variant. */
	onVariantLabelChange: (label: string) => void;
	setRows: (rows: MixGameGroupRow[]) => void;
	variants: VariantRowLike[];
}

/**
 * Mix-master editing block shared by the ring-game form and the session
 * wizard (c47): pairs with `shared/components/mix-form-sheet`. Composition
 * edits go through the master (dedicated bottom sheet), never inline — the
 * mix editor shows amounts only. Saving the master renames the frozen
 * variant label if needed and re-derives the buckets, keeping the amounts
 * of groups that survive.
 */
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

	// The mix master row backing a frozen variant label — null for plain
	// variants and the legacy "mix" key (which has no master to edit).
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

	// `gameLabels` is the sheet's own id→label resolution of the games it
	// just saved. Preferred over re-resolving through `variants` here: a
	// just-created variant id missing from a stale list must not silently
	// drop its game from the reseeded rows (c19).
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
