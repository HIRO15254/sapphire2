import { useEffect, useRef, useState } from "react";
import {
	addEmptyGroup,
	autoGroupNames,
	canAddGroup,
	canToggleVariantInGroup,
	describeMixValidity,
	groupStructure,
	type MixTarget,
	removeVariantFromGroup,
	summarizeMix,
	toggleVariantInGroup,
} from "@/features/live-sessions/utils/mix-composition";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import {
	hasMixCellErrors,
	MIX_AMOUNT_SLOTS,
	type MixGameGroupRow,
	type MixGroupInfo,
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
	groups: readonly MixGameGroupRow[];
	onOpenChange: (open: boolean) => void;
	onSave: (rows: MixGameGroupRow[]) => void;
	open: boolean;
	target: MixEditorTarget;
}

const CASH_HINT =
	"A group holds games that share one blind structure, and each game belongs to exactly one group. Set each group's stakes in Basics.";
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

function describePickerHint(structure: MixGroupInfo | null): string {
	if (structure === null) {
		return "The first game sets this group's blind structure. Games used by another group are greyed out.";
	}
	return `This group uses ${structure.label} blinds, so only ${structure.label} games can join it. Games used by another group are greyed out.`;
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
			const seeded =
				groups.length > 0
					? [...groups]
					: addEmptyGroup([], groupFor(""), crypto.randomUUID());
			setRows(seeded);
			setInitialRows(seeded);
			setPickingUid(null);
		}
		wasOpenRef.current = open;
	}, [open, groups, groupFor]);

	const discard = useDiscardConfirm({
		isDirty: () => JSON.stringify(rows) !== JSON.stringify(initialRows),
		onOpenChange,
	});

	const validity = describeMixValidity(rows, kind);
	const hasCellErrors = hasMixCellErrors(rows);
	const clearsLevelGames = kind === "level" && rows.length === 0;
	const canSave = !hasCellErrors && (validity.isValid || clearsLevelGames);
	const autoNames = autoGroupNames(rows, groupFor);
	const pickingRow = rows.find((row) => row.uid === pickingUid) ?? null;

	const shortLabelByLabel = new Map(
		variants.map((row) => [normalized(row.label), row.shortLabel ?? row.label])
	);

	const onSubmit = () => {
		if (!canSave) {
			return;
		}
		onSave(rows);
		onOpenChange(false);
	};

	return {
		canAddGroup: canAddGroup(rows),
		canSave,
		discard,
		groups: rows.map((row, index) => ({
			cells:
				kind === "level"
					? MIX_AMOUNT_SLOTS.filter(
							(slot) => slot !== "blind3" || row.blind3Label !== null
						).map((slot) => ({
							error: mixCellError(row[slot]),
							label: cellLabel(row, slot),
							slot,
							value: row[slot],
						}))
					: [],
			name: row.name ?? autoNames[index] ?? "",
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
		onRenameGroupEnd: (uid: string) =>
			setRows((current) =>
				current.map((row) =>
					row.uid === uid && row.name?.trim() === ""
						? { ...row, name: null }
						: row
				)
			),
		onSubmit,
		picker: {
			hint: describePickerHint(
				pickingRow === null ? null : groupStructure(pickingRow, groupFor)
			),
			isDisabled: (label: string) =>
				pickingUid !== null &&
				!canToggleVariantInGroup(rows, pickingUid, label, groupFor),
			isPicked: (label: string) =>
				pickingRow?.variants.some(
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
