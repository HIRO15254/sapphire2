import {
	addGroup,
	addVariantToGroup,
	type MixGameGroupRow,
	type MixTemplateKind,
	mixTemplate,
	moveGroup,
	removeGroup,
	removeVariantFromGroup,
	updateGroup,
	usedVariants,
} from "@/shared/lib/mix-games";

interface UseMixGamesEditorArgs {
	onChange: (rows: MixGameGroupRow[]) => void;
	value: MixGameGroupRow[];
}

/**
 * Handler layer of the mix-games group editor: every mutation goes through
 * the pure helpers in shared/lib/mix-games and is emitted via onChange
 * (controlled-component contract, like ChipPurchasesEditor).
 */
export function useMixGamesEditor({ onChange, value }: UseMixGamesEditorArgs) {
	return {
		usedVariantList: usedVariants(value),
		onAddGroup: () => onChange(addGroup(value)),
		onRemoveGroup: (uid: string) => onChange(removeGroup(value, uid)),
		onMoveUp: (uid: string) => onChange(moveGroup(value, uid, "up")),
		onMoveDown: (uid: string) => onChange(moveGroup(value, uid, "down")),
		onUpdateGroup: (
			uid: string,
			patch: Partial<Omit<MixGameGroupRow, "uid">>
		) => onChange(updateGroup(value, uid, patch)),
		onAddVariant: (uid: string, variant: string) =>
			onChange(addVariantToGroup(value, uid, variant)),
		onRemoveVariant: (uid: string, variant: string) =>
			onChange(removeVariantFromGroup(value, uid, variant)),
		onApplyTemplate: (kind: MixTemplateKind) => onChange(mixTemplate(kind)),
	};
}
