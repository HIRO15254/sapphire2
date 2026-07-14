import { IconArchive, IconArchiveOff, IconPlus } from "@tabler/icons-react";
import { DeleteGameDialog } from "@/features/rooms/components/delete-game-dialog";
import { GameActionsDrawer } from "@/features/rooms/components/game-actions-drawer";
import { RingGameForm } from "@/features/rooms/components/ring-game-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { Button } from "@/shared/components/ui/button";
import { RingGameContent } from "./ring-game-content";
import { useRingGameTab } from "./use-ring-game-tab";

const CREATE_FORM_ID = "ring-game-create-form";
const EDIT_FORM_ID = "ring-game-edit-form";

export function RingGameTab({ roomId }: { roomId: string }) {
	const {
		showArchived,
		toggleArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingGame,
		setEditingGame,
		actionsTarget,
		pendingDelete,
		activeGames,
		archivedGames,
		currencies,
		activeLoading,
		isInitialLoadError,
		onRetry,
		archivedLoading,
		isCreatePending,
		isUpdatePending,
		handleCreate,
		handleUpdate,
		openActions,
		closeActions,
		openEditFromActions,
		openDeleteFromActions,
		handleArchiveFromActions,
		handleRestoreFromActions,
		cancelDelete,
		handleConfirmDelete,
	} = useRingGameTab({ roomId });

	return (
		<div className="flex flex-col gap-3">
			<Button
				className="w-full"
				onClick={() => setIsCreateOpen(true)}
				size="lg"
			>
				<IconPlus className="size-5" />
				Add cash game
			</Button>

			<RingGameContent
				activeGames={activeGames}
				activeLoading={activeLoading}
				archivedGames={archivedGames}
				archivedLoading={archivedLoading}
				currencies={currencies}
				isInitialLoadError={isInitialLoadError}
				onOpenActions={openActions}
				onRetry={onRetry}
				showArchived={showArchived}
			/>

			<Button
				className="self-center text-muted-foreground"
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
				title="Add cash game"
			>
				<RingGameForm formId={CREATE_FORM_ID} onSubmit={handleCreate} />
			</FormSheet>

			<FormSheet
				formId={EDIT_FORM_ID}
				isLoading={isUpdatePending}
				onOpenChange={(open) => {
					if (!open) {
						setEditingGame(null);
					}
				}}
				open={editingGame !== null}
				title="Edit cash game"
			>
				{editingGame ? (
					<RingGameForm
						defaultValues={{
							name: editingGame.name,
							variant: editingGame.variant,
							// Omitting the frozen snapshot here made every edit of a
							// mix ring game submit mixGames: null and wipe it (c02).
							mixGames: editingGame.mixGames ?? null,
							blind1: editingGame.blind1 ?? undefined,
							blind2: editingGame.blind2 ?? undefined,
							blind3: editingGame.blind3 ?? undefined,
							ante: editingGame.ante ?? undefined,
							anteType: (editingGame.anteType ?? undefined) as
								| "all"
								| "bb"
								| "none"
								| undefined,
							minBuyIn: editingGame.minBuyIn ?? undefined,
							maxBuyIn: editingGame.maxBuyIn ?? undefined,
							tableSize: editingGame.tableSize ?? undefined,
							currencyId: editingGame.currencyId ?? undefined,
							memo: editingGame.memo ?? undefined,
						}}
						formId={EDIT_FORM_ID}
						onSubmit={handleUpdate}
					/>
				) : null}
			</FormSheet>

			<GameActionsDrawer
				isArchived={actionsTarget?.archivedAt != null}
				label="cash game"
				onArchive={handleArchiveFromActions}
				onDelete={openDeleteFromActions}
				onEdit={openEditFromActions}
				onOpenChange={(open) => {
					if (!open) {
						closeActions();
					}
				}}
				onRestore={handleRestoreFromActions}
				open={actionsTarget !== null}
			/>

			<DeleteGameDialog
				label="cash game"
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
	);
}
