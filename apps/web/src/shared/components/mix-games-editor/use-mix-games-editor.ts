import {
	addVariant,
	type MixGameGroupRow,
	type MixTemplateKind,
	mixTemplate,
	type ResolveGroup,
	removeVariant,
	updateGroup,
	usedVariants,
} from "@/shared/lib/mix-games";

interface UseMixGamesEditorArgs {
	onChange: (rows: MixGameGroupRow[]) => void;
	/** variant label → its owning group (master mapping). */
	resolveGroup: ResolveGroup;
	/** builtinKey → the user's variant label (null when deleted). */
	resolveVariantLabel: (builtinKey: string) => string | null;
	value: MixGameGroupRow[];
}

/**
 * Handler layer of the mix-games editor: buckets are derived from the
 * master variant→group mapping (injected as resolvers so this stays
 * decoupled from trpc); every mutation goes through the pure helpers and
 * is emitted via onChange (controlled-component contract).
 */
export function useMixGamesEditor({
	onChange,
	resolveGroup,
	resolveVariantLabel,
	value,
}: UseMixGamesEditorArgs) {
	return {
		usedVariantList: usedVariants(value),
		onAddVariant: (variantLabel: string) =>
			onChange(addVariant(value, variantLabel, resolveGroup)),
		onRemoveVariant: (variantLabel: string) =>
			onChange(removeVariant(value, variantLabel)),
		onUpdateGroup: (
			uid: string,
			patch: Partial<Omit<MixGameGroupRow, "uid" | "groupId">>
		) => onChange(updateGroup(value, uid, patch)),
		onApplyTemplate: (kind: MixTemplateKind) =>
			onChange(mixTemplate(kind, resolveVariantLabel, resolveGroup)),
	};
}
