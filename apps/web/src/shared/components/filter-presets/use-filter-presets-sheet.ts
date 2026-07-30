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
	/** Drives the reset of the sheet's transient state on close. */
	open: boolean;
	screenKey: FilterPresetScreenKey;
}

/**
 * The mutation errors are already surfaced to the user by the global
 * `MutationCache.onError` toast in `utils/trpc.ts`; these catches exist purely
 * so the rejected promise is handled. A duplicate name is one tap away
 * (CONFLICT), so the unhandled-rejection path was trivially reachable.
 */
const swallowHandledMutationError = () => {
	// Intentionally empty — see the doc comment above.
};

/**
 * Owns the interactive state (active tab, pending delete confirmation, pending
 * rename/overwrite) for the Presets bottom sheet, on top of the
 * screen-agnostic `useFilterPresets` data hook. Generic over the caller's
 * payload shape so `onApply` / `currentPayload` stay typed to the caller's own
 * screenKey.
 */
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

	// The sheet stays mounted between openings, so without this reset a user who
	// left off on "Save new" (or mid-confirmation) is dropped back there the next
	// time they open it.
	useEffect(() => {
		if (!open) {
			setActiveTab("saved");
			setPendingDelete(null);
			setPendingEdit(null);
		}
	}, [open]);

	/**
	 * The edit form is a drill-down out of a row inside the "Saved" tab, not a
	 * peer of the tabs, so leaving that tab abandons it. Without this, switching
	 * to "Save new" and back dropped the user into the rename form again with the
	 * list hidden.
	 */
	const onChangeTab = (tab: FilterPresetsSheetTab) => {
		setActiveTab(tab);
		setPendingEdit(null);
	};

	const onApplyPreset = (preset: FilterPresetItem) => {
		onApply(preset.payload as TPayload);
		onOpenChange(false);
	};

	/**
	 * Returns the promise (rather than dropping it) for the same reason the other
	 * handlers do: the star has no confirmation step, so a rejected
	 * setDefault / clearDefault was the most reachable unhandled rejection on
	 * this surface.
	 */
	const onToggleDefault = (preset: FilterPresetItem) => {
		const mutate = preset.isDefault ? clearDefault : setDefault;
		return mutate(preset.id)
			.then(() => {
				// Nothing local to settle — the list cache is updated optimistically
				// inside the mutation itself.
			})
			.catch(swallowHandledMutationError);
	};

	// Delete confirmation and the rename form are separate surfaces for the same
	// row, so opening one closes the other — otherwise confirming a delete leaves
	// the edit form mounted for a row that no longer exists.
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

	/**
	 * One action, two effects by design: the preset is renamed *and* re-pointed
	 * at the caller's current filters, so "I tweaked my filters and want this
	 * preset to match" is a single interaction. On failure the form stays open
	 * (with the rejected name still in it) so the user can pick another one.
	 */
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
		// The star is one toggle, so the button must be disabled while a default
		// change is in flight in EITHER direction — exposing only the set-default
		// flag left the clear path unguarded.
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
