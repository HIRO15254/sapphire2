import type { FilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { useEffect, useState } from "react";
import type {
	FilterPresetItem,
	FilterPresetScreenKey,
} from "@/shared/hooks/use-filter-presets";
import { useFilterPresets } from "@/shared/hooks/use-filter-presets";

export type FilterPresetsSheetTab = "saved" | "create";

interface UseFilterPresetsSheetOptions<TPayload extends FilterPresetPayload> {
	currentPayload: TPayload;
	onApply: (payload: TPayload) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	screenKey: FilterPresetScreenKey;
}

const swallowHandledMutationError = () => undefined;

export function useFilterPresetsSheet<TPayload extends FilterPresetPayload>({
	currentPayload,
	onApply,
	onOpenChange,
	open,
	screenKey,
}: UseFilterPresetsSheetOptions<TPayload>) {
	const {
		presets,
		isLoading,
		isCreatePending,
		isUpdatePending,
		isDeletePending,
		isSetDefaultPending,
		isClearDefaultPending,
		create,
		update,
		remove,
		setDefault,
		clearDefault,
	} = useFilterPresets(screenKey);

	const [activeTab, setActiveTab] = useState<FilterPresetsSheetTab>("saved");
	const [pendingDelete, setPendingDelete] = useState<FilterPresetItem | null>(
		null
	);
	const [pendingEdit, setPendingEdit] = useState<FilterPresetItem | null>(null);

	useEffect(() => {
		if (!open) {
			setActiveTab("saved");
			setPendingDelete(null);
			setPendingEdit(null);
		}
	}, [open]);

	const onChangeTab = (tab: FilterPresetsSheetTab) => {
		setActiveTab(tab);
		setPendingEdit(null);
	};

	const onApplyPreset = (preset: FilterPresetItem) => {
		onApply(preset.payload as TPayload);
		onOpenChange(false);
	};

	const onToggleDefault = (preset: FilterPresetItem) => {
		const mutate = preset.isDefault ? clearDefault : setDefault;
		return mutate(preset.id)
			.then(() => undefined)
			.catch(swallowHandledMutationError);
	};

	const onRequestDelete = (preset: FilterPresetItem) => {
		setPendingEdit(null);
		setPendingDelete(preset);
	};

	const onCancelDelete = () => {
		setPendingDelete(null);
	};

	const onConfirmDelete = () => {
		if (!pendingDelete) {
			return Promise.resolve();
		}
		return remove(pendingDelete.id)
			.then(() => {
				setPendingDelete(null);
			})
			.catch(swallowHandledMutationError);
	};

	const onSaveNew = (name: string) => {
		return create({ name, payload: currentPayload })
			.then(() => {
				onChangeTab("saved");
			})
			.catch(swallowHandledMutationError);
	};

	const onRequestEdit = (preset: FilterPresetItem) => {
		setPendingDelete(null);
		setPendingEdit(preset);
	};

	const onCancelEdit = () => {
		setPendingEdit(null);
	};

	const onSubmitEdit = (name: string) => {
		if (!pendingEdit) {
			return Promise.resolve();
		}
		return update({ id: pendingEdit.id, name, payload: currentPayload })
			.then(() => {
				setPendingEdit(null);
			})
			.catch(swallowHandledMutationError);
	};

	return {
		activeTab,
		setActiveTab: onChangeTab,
		presets,
		isLoading,
		isCreatePending,
		isUpdatePending,
		isDeletePending,
		isDefaultTogglePending: isSetDefaultPending || isClearDefaultPending,
		pendingDelete,
		pendingEdit,
		onApplyPreset,
		onToggleDefault,
		onRequestDelete,
		onCancelDelete,
		onConfirmDelete,
		onSaveNew,
		onRequestEdit,
		onCancelEdit,
		onSubmitEdit,
	};
}
