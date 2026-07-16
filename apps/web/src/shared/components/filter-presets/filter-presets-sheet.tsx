import type { FilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { IconStar, IconStarFilled, IconTrash } from "@tabler/icons-react";
import {
	ManagementList,
	ManagementListItem,
} from "@/shared/components/management/management-list";
import { TagNameForm } from "@/shared/components/management/tag-name-form";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import type {
	FilterPresetItem,
	FilterPresetScreenKey,
} from "@/shared/hooks/use-filter-presets";
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

function SavedPresetsList({
	onApplyPreset,
	onRequestDelete,
	onToggleDefault,
	presets,
}: {
	onApplyPreset: (preset: FilterPresetItem) => void;
	onRequestDelete: (preset: FilterPresetItem) => void;
	onToggleDefault: (preset: FilterPresetItem) => void;
	presets: FilterPresetItem[];
}) {
	if (presets.length === 0) {
		return (
			<EmptyState
				className="px-4 py-8"
				description="Save your current filters to reuse them later."
				heading="No saved presets yet"
			/>
		);
	}
	return (
		<ManagementList>
			{presets.map((preset) => (
				<ManagementListItem
					actions={
						<div className="flex gap-1">
							<Button
								aria-label={
									preset.isDefault
										? `Unset ${preset.name} as default`
										: `Set ${preset.name} as default`
								}
								onClick={(e) => {
									e.stopPropagation();
									onToggleDefault(preset);
								}}
								size="sm"
								variant="ghost"
							>
								{preset.isDefault ? (
									<IconStarFilled size={16} />
								) : (
									<IconStar size={16} />
								)}
							</Button>
							<Button
								aria-label={`Delete ${preset.name}`}
								onClick={(e) => {
									e.stopPropagation();
									onRequestDelete(preset);
								}}
								size="sm"
								variant="ghost"
							>
								<IconTrash size={16} />
							</Button>
						</div>
					}
					key={preset.id}
					title={
						<button
							className="text-left"
							onClick={() => onApplyPreset(preset)}
							type="button"
						>
							{preset.name}
						</button>
					}
				/>
			))}
		</ManagementList>
	);
}

/**
 * Hybrid tabbed picker sheet for filter presets — mirrors
 * `assign-ring-game-dialog.tsx`'s Drawer/Tabs structure
 * (`.claude/rules/web-theme.md` — "Hybrid / tabbed picker sheet"). Generic
 * over the caller's payload shape so `currentPayload` / `onApply` stay typed
 * to the calling screen's own filter shape.
 */
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
		isCreatePending,
		isDeletePending,
		pendingDelete,
		onApplyPreset,
		onToggleDefault,
		onRequestDelete,
		onCancelDelete,
		onConfirmDelete,
		onSaveNew,
	} = useFilterPresetsSheet<TPayload>({
		currentPayload,
		onApply,
		onOpenChange,
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

						{activeTab === "saved" ? (
							<SavedPresetsList
								onApplyPreset={onApplyPreset}
								onRequestDelete={onRequestDelete}
								onToggleDefault={onToggleDefault}
								presets={presets}
							/>
						) : (
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
						)}
					</div>
				</DrawerContent>
			</Drawer>

			<Dialog
				onOpenChange={(o) => {
					if (!o) {
						onCancelDelete();
					}
				}}
				open={pendingDelete !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete preset?</DialogTitle>
						<DialogDescription>
							{pendingDelete ? (
								<>
									Are you sure you want to delete the preset &ldquo;
									{pendingDelete.name}&rdquo;?
								</>
							) : null}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex-row justify-end gap-2">
						<Button onClick={onCancelDelete} type="button" variant="outline">
							Cancel
						</Button>
						<Button
							disabled={isDeletePending}
							onClick={onConfirmDelete}
							type="button"
							variant="destructive"
						>
							{isDeletePending ? "Deleting..." : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
