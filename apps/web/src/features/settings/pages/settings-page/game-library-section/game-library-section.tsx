import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { GroupCard } from "./group-card";
import { GroupFormSheet } from "./group-form-sheet";
import { useGameLibrarySection } from "./use-game-library-section";
import { VariantFormSheet } from "./variant-form-sheet";

/**
 * Merged "Games" settings section: one card per game group with its
 * variants listed inside (mix-game rework) — makes "every variant belongs
 * to exactly one group" visible and adds in-place variant creation via
 * each card's "Add variant" footer button.
 */
export function GameLibrarySection() {
	const {
		groups,
		groupOptions,
		isLoading,
		isGroupSheetOpen,
		editingGroup,
		onAddGroup,
		onEditGroup,
		onGroupSheetOpenChange,
		isVariantSheetOpen,
		editingVariant,
		createGroupId,
		onAddVariant,
		onEditVariant,
		onVariantSheetOpenChange,
		deletingGroup,
		onDeleteGroupRequest,
		onDeleteGroupConfirm,
		onDeleteGroupCancel,
		isDeleteGroupPending,
		deletingVariant,
		onDeleteVariantRequest,
		onDeleteVariantConfirm,
		onDeleteVariantCancel,
		isDeleteVariantPending,
	} = useGameLibrarySection();

	if (isLoading) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				Loading games...
			</p>
		);
	}

	return (
		<>
			<div className="mb-3 flex justify-end">
				<Button onClick={onAddGroup} size="sm" type="button">
					<IconPlus size={16} />
					Add group
				</Button>
			</div>

			<div className="space-y-3">
				{groups.map((entry) => (
					<GroupCard
						entry={entry}
						key={entry.group.id}
						onAddVariant={onAddVariant}
						onDeleteGroup={onDeleteGroupRequest}
						onDeleteVariant={onDeleteVariantRequest}
						onEditGroup={onEditGroup}
						onEditVariant={onEditVariant}
					/>
				))}
			</div>

			<GroupFormSheet
				editingGroup={editingGroup}
				key={editingGroup ? `edit-${editingGroup.id}` : "create"}
				onOpenChange={onGroupSheetOpenChange}
				open={isGroupSheetOpen}
			/>

			<VariantFormSheet
				createGroupId={createGroupId}
				editingVariant={editingVariant}
				groups={groupOptions}
				key={
					editingVariant
						? `edit-${editingVariant.id}`
						: `create-${createGroupId ?? "none"}`
				}
				onOpenChange={onVariantSheetOpenChange}
				open={isVariantSheetOpen}
			/>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onDeleteGroupCancel();
					}
				}}
				open={deletingGroup !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this group?</DialogTitle>
						<DialogDescription>
							{deletingGroup?.label} will be removed from your group list. This
							is only possible while no variant uses it.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex-row justify-end gap-2">
						<Button
							onClick={onDeleteGroupCancel}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={isDeleteGroupPending}
							onClick={onDeleteGroupConfirm}
							type="button"
							variant="destructive"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onDeleteVariantCancel();
					}
				}}
				open={deletingVariant !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this variant?</DialogTitle>
						<DialogDescription>
							{deletingVariant?.label} will be removed from your variant list.
							Games and sessions that already used it keep the frozen name.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex-row justify-end gap-2">
						<Button
							onClick={onDeleteVariantCancel}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							disabled={isDeleteVariantPending}
							onClick={onDeleteVariantConfirm}
							type="button"
							variant="destructive"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
