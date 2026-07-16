import { IconArchive, IconArchiveOff, IconPlus } from "@tabler/icons-react";
import { DeleteGameDialog } from "@/features/rooms/components/delete-game-dialog";
import { GameActionsDrawer } from "@/features/rooms/components/game-actions-drawer";
import { TournamentFormSheet } from "@/features/rooms/components/tournament-form-sheet";
import { Button } from "@/shared/components/ui/button";
import { TournamentContent } from "./tournament-content";
import { useTournamentTab } from "./use-tournament-tab";

const CREATE_FORM_ID = "tournament-create-form";
const EDIT_FORM_ID = "tournament-edit-form";

export function TournamentTab({ roomId }: { roomId: string }) {
	const {
		activeTournaments,
		archivedTournaments,
		currencies,
		activeLoading,
		archivedLoading,
		isInitialLoadError,
		onRetry,
		showArchived,
		toggleArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingTournament,
		setEditingTournament,
		actionsTarget,
		pendingDelete,
		isCreateLoading,
		isUpdateLoading,
		editBlindLevelsError,
		editBlindLevelsLoading,
		retryEditBlindLevels,
		editInitialFormValues,
		editInitialLevels,
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
	} = useTournamentTab({ roomId });

	return (
		<div className="flex flex-col gap-3">
			<Button
				className="w-full"
				onClick={() => setIsCreateOpen(true)}
				size="lg"
			>
				<IconPlus className="size-5" />
				Add tournament
			</Button>

			<TournamentContent
				activeLoading={activeLoading}
				activeTournaments={activeTournaments}
				archivedLoading={archivedLoading}
				archivedTournaments={archivedTournaments}
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

			<TournamentFormSheet
				aiMode="create"
				formId={CREATE_FORM_ID}
				initialBlindLevels={[]}
				isLoading={isCreateLoading}
				onOpenChange={setIsCreateOpen}
				onSave={handleCreate}
				open={isCreateOpen}
				title="Add tournament"
			/>

			<TournamentFormSheet
				aiMode="edit"
				editBlindLevelsError={editBlindLevelsError}
				formId={EDIT_FORM_ID}
				initialBlindLevels={editInitialLevels}
				initialFormValues={editInitialFormValues}
				isInitializing={editBlindLevelsLoading}
				isLoading={isUpdateLoading}
				onOpenChange={(open) => {
					if (!open) {
						setEditingTournament(null);
					}
				}}
				onRetryBlindLevels={retryEditBlindLevels}
				onSave={handleUpdate}
				open={editingTournament !== null}
				resetKey={editingTournament?.id}
				title="Edit tournament"
			/>

			<GameActionsDrawer
				isArchived={actionsTarget?.archivedAt != null}
				label="tournament"
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
				label="tournament"
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
