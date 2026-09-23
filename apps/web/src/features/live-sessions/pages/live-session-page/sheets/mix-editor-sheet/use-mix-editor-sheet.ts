import type { LevelGameGroup, MixGameGroup } from "@sapphire2/db/schemas/game";
import { useEffect, useRef, useState } from "react";
import {
	addEmptyGroup,
	canAddGroup,
	describeMixValidity,
	isVariantTakenElsewhere,
	type MixTarget,
	removeVariantFromGroup,
	summarizeMix,
	toggleVariantInGroup,
	withDerivedAnteTypes,
} from "@/features/live-sessions/utils/mix-composition";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import {
	fromLevelGames,
	fromMixGames,
	hasMixCellErrors,
	MIX_AMOUNT_SLOTS,
	type MixGameGroupRow,
	mixCellError,
	removeGroup,
	updateGroup,
} from "@/shared/lib/mix-games";
import { useDiscardConfirm } from "../use-discard-confirm";

export type MixEditorTarget =
	| { kind: "cash" }
	| { kind: "level"; levelNumber: number };

export type MixAmountSlot = (typeof MIX_AMOUNT_SLOTS)[number];

interface UseMixEditorSheetOptions {
	groups: readonly (LevelGameGroup | MixGameGroup)[] | null;
	onOpenChange: (open: boolean) => void;
	onSave: (rows: MixGameGroupRow[]) => void;
	open: boolean;
	target: MixEditorTarget;
}

const CASH_HINT =
	"Each game belongs to exactly one group, and every group keeps its own stakes — that is how a limit round and a big-bet round can sit in the same session.";
const LEVEL_HINT =
	"Levels without a composition fall back to the session game type. Games set here override it for this level only.";

function cellLabel(row: MixGameGroupRow, slot: MixAmountSlot): string {
	if (slot === "blind1") {
		return row.blind1Label;
	}
	if (slot === "blind2") {
		return row.blind2Label;
	}
	if (slot === "blind3") {
		return row.blind3Label ?? "";
	}
	return "Ante";
}

function normalized(value: string): string {
	return value.trim().toLowerCase();
}

export function useMixEditorSheet({
	groups,
	onOpenChange,
	onSave,
	open,
	target,
}: UseMixEditorSheetOptions) {
	const { groupFor, variants } = useGameGroups();
	const [rows, setRows] = useState<MixGameGroupRow[]>([]);
	const [initialRows, setInitialRows] = useState<MixGameGroupRow[]>([]);
	const [pickingUid, setPickingUid] = useState<string | null>(null);
	const kind: MixTarget = target.kind;

	const wasOpenRef = useRef(false);
	useEffect(() => {
		if (open && !wasOpenRef.current) {
			const loaded =
				kind === "cash"
					? fromMixGames(groups as MixGameGroup[] | null, groupFor)
					: fromLevelGames(groups as LevelGameGroup[] | null, groupFor);
			const seeded =
				loaded.length > 0
					? loaded
					: addEmptyGroup([], groupFor(""), crypto.randomUUID());
			setRows(seeded);
			setInitialRows(seeded);
			setPickingUid(null);
		}
		wasOpenRef.current = open;
	}, [open, groups, groupFor, kind]);

	const discard = useDiscardConfirm({
		isDirty: () => JSON.stringify(rows) !== JSON.stringify(initialRows),
		onOpenChange,
	});

	const validity = describeMixValidity(rows, kind);
	const hasCellErrors = hasMixCellErrors(rows);
	const canSave = !hasCellErrors && (kind === "level" || validity.isValid);

	const shortLabelByLabel = new Map(
		variants.map((row) => [normalized(row.label), row.shortLabel ?? row.label])
	);

	const onSubmit = () => {
		if (!canSave) {
			return;
		}
		onSave(withDerivedAnteTypes(rows));
		onOpenChange(false);
	};

	return {
		canAddGroup: canAddGroup(rows),
		canSave,
		discard,
		groups: rows.map((row, index) => ({
			cells: MIX_AMOUNT_SLOTS.filter(
				(slot) => slot !== "blind3" || row.blind3Label !== null
			).map((slot) => ({
				error: mixCellError(row[slot]),
				label: cellLabel(row, slot),
				slot,
				value: row[slot],
			})),
			familyLabel: row.groupLabel,
			name: row.name ?? "",
			number: index + 1,
			uid: row.uid,
			variants: row.variants.map((label) => ({
				code: shortLabelByLabel.get(normalized(label)) ?? label,
				label,
			})),
		})),
		hint: kind === "cash" ? CASH_HINT : LEVEL_HINT,
		onAddGroup: () =>
			setRows((current) =>
				addEmptyGroup(current, groupFor(""), crypto.randomUUID())
			),
		onCellChange: (uid: string, slot: MixAmountSlot, value: string) =>
			setRows((current) => updateGroup(current, uid, { [slot]: value })),
		onOpenGames: setPickingUid,
		onRemoveGroup: (uid: string) =>
			setRows((current) => removeGroup(current, uid)),
		onRemoveVariant: (uid: string, label: string) =>
			setRows((current) => removeVariantFromGroup(current, uid, label)),
		onRenameGroup: (uid: string, name: string) =>
			setRows((current) => updateGroup(current, uid, { name })),
		onSubmit,
		picker: {
			isDisabled: (label: string) =>
				pickingUid !== null && isVariantTakenElsewhere(rows, pickingUid, label),
			isPicked: (label: string) =>
				rows
					.find((row) => row.uid === pickingUid)
					?.variants.some(
						(variant) => normalized(variant) === normalized(label)
					) ?? false,
			onOpenChange: (next: boolean) => {
				if (!next) {
					setPickingUid(null);
				}
			},
			onToggle: (label: string) => {
				if (pickingUid === null) {
					return;
				}
				setRows((current) =>
					toggleVariantInGroup(current, pickingUid, label, groupFor)
				);
			},
			open: pickingUid !== null,
		},
		summary: summarizeMix(rows),
		title:
			target.kind === "cash"
				? "Game composition"
				: `Level ${target.levelNumber} games`,
		validity,
	};
}
