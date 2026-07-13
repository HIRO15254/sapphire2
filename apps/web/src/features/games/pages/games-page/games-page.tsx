import { IconPlus } from "@tabler/icons-react";
import { MixFormSheet } from "@/shared/components/mix-form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { GroupCard } from "./group-card";
import { GroupFormSheet } from "./group-form-sheet";
import { MixesCard } from "./mixes-card";
import { useGamesPage } from "./use-games-page";
import { VariantFormSheet } from "./variant-form-sheet";

/**
 * Top-level Games page: one card per game group with its variants listed
 * inside (mix-game rework) — makes "every variant belongs to exactly one
 * group" visible and adds in-place variant creation via each card's "Add
 * variant" footer button.
 */
export function GamesPage() {
	const {
		groups,
		groupOptions,
		mixes,
		variants,
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
		isMixSheetOpen,
		editingMix,
		onAddMix,
		onEditMix,
		onMixSheetOpenChange,
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
		deletingMix,
		onDeleteMixRequest,
		onDeleteMixConfirm,
		onDeleteMixCancel,
		isDeleteMixPending,
	} = useGamesPage();

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<>
							<Button onClick={onAddGroup} size="sm" type="button">
								<IconPlus size={16} />
								Add group
							</Button>
							<Button onClick={onAddMix} size="sm" type="button">
								<IconPlus size={16} />
								Add mix
							</Button>
						</>
					}
					heading="Games"
				/>

				{isLoading ? (
					<p className="py-4 text-center text-muted-foreground text-sm">
						Loading games...
					</p>
				) : (
					<>
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

							<MixesCard
								mixes={mixes}
								onDeleteMix={onDeleteMixRequest}
								onEditMix={onEditMix}
								variants={variants}
							/>
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

						<MixFormSheet
							editingMix={editingMix}
							key={editingMix ? `edit-${editingMix.id}` : "create"}
							onOpenChange={onMixSheetOpenChange}
							open={isMixSheetOpen}
							variants={variants}
						/>

						<DeleteConfirmDialog
							description={
								<>
									{deletingGroup?.label} will be removed from your group list.
									This is only possible while no variant uses it.
								</>
							}
							isPending={isDeleteGroupPending}
							onCancel={onDeleteGroupCancel}
							onConfirm={onDeleteGroupConfirm}
							open={deletingGroup !== null}
							title="Delete this group?"
						/>

						<DeleteConfirmDialog
							description={
								<>
									{deletingVariant?.label} will be removed from your variant
									list. Games and sessions that already used it keep the frozen
									name.
								</>
							}
							isPending={isDeleteVariantPending}
							onCancel={onDeleteVariantCancel}
							onConfirm={onDeleteVariantConfirm}
							open={deletingVariant !== null}
							title="Delete this variant?"
						/>

						<DeleteConfirmDialog
							description={
								<>
									{deletingMix?.label} will be removed from your mix list. Games
									and sessions that already used it keep the frozen name.
								</>
							}
							isPending={isDeleteMixPending}
							onCancel={onDeleteMixCancel}
							onConfirm={onDeleteMixConfirm}
							open={deletingMix !== null}
							title="Delete this mix?"
						/>
					</>
				)}
			</div>
		</div>
	);
}
