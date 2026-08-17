import {
	addVariant,
	type MixGameGroupRow,
	type ResolveGroup,
	removeGroup,
	removeVariant,
	updateGroup,
	usedVariants,
} from "@/shared/lib/mix-games";

interface UseMixGamesEditorArgs {
	onChange: (rows: MixGameGroupRow[]) => void;
	resolveGroup: ResolveGroup;
	value: MixGameGroupRow[];
}

export function useMixGamesEditor({
	onChange,
	resolveGroup,
	value,
}: UseMixGamesEditorArgs) {
	return {
		usedVariantList: usedVariants(value),
		onAddVariant: (variantLabel: string) =>
			onChange(addVariant(value, variantLabel, resolveGroup)),
		onRemoveVariant: (variantLabel: string) =>
			onChange(removeVariant(value, variantLabel)),
		onRemoveGroup: (uid: string) => onChange(removeGroup(value, uid)),
		onUpdateGroup: (
			uid: string,
			patch: Partial<Omit<MixGameGroupRow, "uid" | "groupId">>
		) => onChange(updateGroup(value, uid, patch)),
		onUpdateAnteType: (uid: string, anteType: MixGameGroupRow["anteType"]) =>
			onChange(
				updateGroup(
					value,
					uid,
					anteType === "none" ? { anteType, ante: "" } : { anteType }
				)
			),
	};
}
