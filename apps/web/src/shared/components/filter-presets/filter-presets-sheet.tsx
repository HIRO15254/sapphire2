import type { FilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { TagNameForm } from "@/shared/components/management/tag-name-form";
import { Button } from "@/shared/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import type { FilterPresetScreenKey } from "@/shared/hooks/use-filter-presets";
import { DeletePresetDialog } from "./delete-preset-dialog";
import { EditPresetForm } from "./edit-preset-form";
import { SavedPresetsList } from "./saved-presets-list";
import type { FilterPresetsSheetTab } from "./use-filter-presets-sheet";
import { useFilterPresetsSheet } from "./use-filter-presets-sheet";

const CREATE_PRESET_FORM_ID = "filter-presets-create-form";

interface FilterPresetsSheetProps<TPayload extends FilterPresetPayload> {
	currentPayload: TPayload;
	onApply: (payload: TPayload) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	screenKey: FilterPresetScreenKey;
}

export function FilterPresetsSheet<TPayload extends FilterPresetPayload>({
	currentPayload,
	onApply,
	onOpenChange,
	open,
	screenKey,
}: FilterPresetsSheetProps<TPayload>) {
	const {
		activeTab,
		setActiveTab,
		presets,
		isLoading,
		isCreatePending,
		isUpdatePending,
		isDeletePending,
		isDefaultTogglePending,
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
	} = useFilterPresetsSheet<TPayload>({
		currentPayload,
		onApply,
		onOpenChange,
		open,
		screenKey,
	});

	return (
		<>
			<Drawer onOpenChange={onOpenChange} open={open}>
				<DrawerContent className="rounded-t-xl">
					<div
						aria-hidden
						className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
					/>
					<DrawerTitle className="t-h4 px-4 pt-1">Presets</DrawerTitle>
					<DrawerDescription className="sr-only">
						Apply a saved filter preset or save your current filters as a new
						preset.
					</DrawerDescription>
					<div className="overflow-y-auto px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
						<Tabs
							className="mb-4"
							onValueChange={(value) =>
								setActiveTab(value as FilterPresetsSheetTab)
							}
							value={activeTab}
						>
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="saved">Saved</TabsTrigger>
								<TabsTrigger value="create">Save new</TabsTrigger>
							</TabsList>
						</Tabs>

						{activeTab === "saved" && pendingEdit === null ? (
							<SavedPresetsList
								isDefaultTogglePending={isDefaultTogglePending}
								isLoading={isLoading}
								onApplyPreset={onApplyPreset}
								onRequestDelete={onRequestDelete}
								onRequestEdit={onRequestEdit}
								onToggleDefault={onToggleDefault}
								presets={presets}
							/>
						) : null}

						{activeTab === "saved" && pendingEdit !== null ? (
							<EditPresetForm
								isPending={isUpdatePending}
								onCancel={onCancelEdit}
								onSubmit={onSubmitEdit}
								preset={pendingEdit}
							/>
						) : null}

						{activeTab === "create" ? (
							<div className="flex flex-col gap-4">
								<TagNameForm
									formId={CREATE_PRESET_FORM_ID}
									label="Preset name"
									onSubmit={onSaveNew}
								/>
								<Button
									disabled={isCreatePending}
									form={CREATE_PRESET_FORM_ID}
									type="submit"
								>
									{isCreatePending ? "Saving..." : "Save"}
								</Button>
							</div>
						) : null}
					</div>
				</DrawerContent>
			</Drawer>

			<DeletePresetDialog
				isPending={isDeletePending}
				onCancel={onCancelDelete}
				onConfirm={onConfirmDelete}
				preset={pendingDelete}
			/>
		</>
	);
}
