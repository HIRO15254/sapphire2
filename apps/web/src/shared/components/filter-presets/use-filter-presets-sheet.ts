import type { FilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { useState } from "react";
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
	screenKey: FilterPresetScreenKey;
}

/**
 * Owns the interactive state (active tab, pending delete confirmation) for
 * the Presets bottom sheet, on top of the screen-agnostic `useFilterPresets`
 * data hook. Generic over the caller's payload shape so `onApply` /
 * `currentPayload` stay typed to the caller's own screenKey.
 */
export function useFilterPresetsSheet<TPayload extends FilterPresetPayload>({
	currentPayload,
	onApply,
	onOpenChange,
	screenKey,
}: UseFilterPresetsSheetOptions<TPayload>) {
	const {
		presets,
		defaultPreset,
		isLoading,
		isCreatePending,
		isDeletePending,
		isSetDefaultPending,
		create,
		remove,
		setDefault,
		clearDefault,
	} = useFilterPresets(screenKey);

	const [activeTab, setActiveTab] = useState<FilterPresetsSheetTab>("saved");
	const [pendingDelete, setPendingDelete] = useState<FilterPresetItem | null>(
		null
	);

	const onApplyPreset = (preset: FilterPresetItem) => {
		onApply(preset.payload as TPayload);
		onOpenChange(false);
	};

	const onToggleDefault = (preset: FilterPresetItem) => {
		if (preset.isDefault) {
			clearDefault(preset.id);
		} else {
			setDefault(preset.id);
		}
	};

	const onRequestDelete = (preset: FilterPresetItem) => {
		setPendingDelete(preset);
	};

	const onCancelDelete = () => {
		setPendingDelete(null);
	};

	const onConfirmDelete = () => {
		if (!pendingDelete) {
			return;
		}
		remove(pendingDelete.id).then(() => {
			setPendingDelete(null);
		});
	};

	const onSaveNew = (name: string) => {
		create({ name, payload: currentPayload }).then(() => {
			setActiveTab("saved");
		});
	};

	return {
		activeTab,
		setActiveTab,
		presets,
		defaultPreset,
		isLoading,
		isCreatePending,
		isDeletePending,
		isSetDefaultPending,
		pendingDelete,
		onApplyPreset,
		onToggleDefault,
		onRequestDelete,
		onCancelDelete,
		onConfirmDelete,
		onSaveNew,
	};
}
