import { IconArchive, IconArchiveOff, IconPlus } from "@tabler/icons-react";
import { GameVariantForm } from "@/features/game-variants/components/game-variant-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { DeleteVariantDialog } from "./delete-variant-dialog";
import { useGameVariantsPage } from "./use-game-variants-page";
import { VariantContent } from "./variant-content";

const CREATE_FORM_ID = "game-variant-create-form";
const EDIT_FORM_ID = "game-variant-edit-form";

export function GameVariantsPage() {
	const {
		activeVariants,
		archivedVariants,
		cancelDelete,
		editingVariant,
		handleArchive,
		handleConfirmDelete,
		handleCreate,
		handleRestore,
		handleUpdate,
		isCreateOpen,
		isCreatePending,
		isLoading,
		isUpdatePending,
		openDelete,
		pendingDelete,
		setEditingVariant,
		setIsCreateOpen,
		showArchived,
		toggleArchived,
	} = useGameVariantsPage();

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button onClick={() => setIsCreateOpen(true)} size="sm">
							<IconPlus size={16} />
							New variant
						</Button>
					}
					heading="Game variants"
				/>

				<VariantContent
					activeVariants={activeVariants}
					archivedVariants={archivedVariants}
					isLoading={isLoading}
					onArchive={handleArchive}
					onDelete={openDelete}
					onEdit={setEditingVariant}
					onRestore={handleRestore}
					showArchived={showArchived}
				/>

				<Button
					className="mt-2 w-full text-muted-foreground"
					onClick={toggleArchived}
					size="sm"
					variant="ghost"
				>
					{showArchived ? (
						<IconArchiveOff className="size-4" />
					) : (
						<IconArchive className="size-4" />
					)}
					{showArchived ? "Hide archived" : "Show archived"}
				</Button>

				<FormSheet
					formId={CREATE_FORM_ID}
					isLoading={isCreatePending}
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
					title="New game variant"
				>
					<GameVariantForm formId={CREATE_FORM_ID} onSubmit={handleCreate} />
				</FormSheet>

				<FormSheet
					formId={EDIT_FORM_ID}
					isLoading={isUpdatePending}
					onOpenChange={(open) => {
						if (!open) {
							setEditingVariant(null);
						}
					}}
					open={editingVariant !== null}
					title="Edit game variant"
				>
					{editingVariant ? (
						<GameVariantForm
							defaultValues={{
								name: editingVariant.name,
								blindLabel1: editingVariant.blindLabel1,
								blindLabel2: editingVariant.blindLabel2,
								blindLabel3: editingVariant.blindLabel3,
							}}
							formId={EDIT_FORM_ID}
							onSubmit={handleUpdate}
						/>
					) : null}
				</FormSheet>

				<DeleteVariantDialog
					name={pendingDelete?.name ?? ""}
					onConfirm={handleConfirmDelete}
					onOpenChange={(open) => {
						if (!open) {
							cancelDelete();
						}
					}}
					open={pendingDelete !== null}
				/>
			</div>
		</div>
	);
}
