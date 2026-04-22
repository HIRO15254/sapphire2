import { IconCards, IconPlus, IconTags } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { SessionCard } from "@/features/sessions/components/session-card";
import { SessionFilters } from "@/features/sessions/components/session-filters";
import { SessionForm } from "@/features/sessions/components/session-form";
import { SessionTagManager } from "@/features/sessions/components/session-tag-manager";
import { buildEditDefaults } from "@/features/sessions/hooks/use-sessions";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Label } from "@/shared/components/ui/label";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { Switch } from "@/shared/components/ui/switch";
import { useSessionsPage } from "./-use-sessions-page";

export const Route = createFileRoute("/sessions/")({
	component: SessionsPage,
});

function SessionsPage() {
	const {
		sessions,
		availableTags,
		isCreatePending,
		isUpdatePending,
		isCreateOpen,
		isTagManagerOpen,
		editingSession,
		filters,
		bbBiMode,
		stores,
		currencies,
		createGames,
		editGames,
		isEditLiveLinked,
		setIsTagManagerOpen,
		setFilters,
		setBbBiMode,
		setSelectedStoreId,
		setEditStoreId,
		handleCreate,
		handleUpdate,
		handleDelete,
		handleReopen,
		handleOpenEdit,
		handleCloseEdit,
		handleCreateDialogOpenChange,
		createTag,
	} = useSessionsPage();

	return (
		<div className="p-4 md:p-6">
			<PageHeader
				actions={
					<>
						<Button
							onClick={() => setIsTagManagerOpen(true)}
							size="sm"
							variant="outline"
						>
							<IconTags size={16} />
							Manage Tags
						</Button>
						<SessionFilters
							currencies={currencies}
							filters={filters}
							onFiltersChange={setFilters}
							stores={stores}
						/>
						<div className="flex items-center gap-1.5">
							<Label className="text-xs" htmlFor="bb-bi-switch">
								BB/BI
							</Label>
							<Switch
								checked={bbBiMode}
								id="bb-bi-switch"
								onCheckedChange={setBbBiMode}
							/>
						</div>
						<Button onClick={() => handleCreateDialogOpenChange(true)}>
							<IconPlus size={16} />
							New Session
						</Button>
					</>
				}
				heading="Sessions"
			/>

			{sessions.length === 0 ? (
				<EmptyState
					action={
						<Button
							onClick={() => handleCreateDialogOpenChange(true)}
							variant="outline"
						>
							<IconPlus size={16} />
							New Session
						</Button>
					}
					description="Record your first poker session to start tracking P&L."
					heading="No sessions yet"
					icon={<IconCards size={48} />}
				/>
			) : (
				<div className="flex flex-col gap-2">
					{sessions.map((s) => (
						<SessionCard
							bbBiMode={bbBiMode}
							key={s.id}
							onDelete={handleDelete}
							onEdit={handleOpenEdit}
							onReopen={handleReopen}
							session={s}
						/>
					))}
				</div>
			)}

			<ResponsiveDialog
				onOpenChange={handleCreateDialogOpenChange}
				open={isCreateOpen}
				title="New Session"
			>
				<SessionForm
					currencies={currencies}
					isLoading={isCreatePending}
					onCreateTag={createTag}
					onStoreChange={setSelectedStoreId}
					onSubmit={handleCreate}
					ringGames={createGames.ringGames}
					stores={stores}
					tags={availableTags}
					tournaments={createGames.tournaments}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={(open) => {
					if (!open) {
						handleCloseEdit();
					}
				}}
				open={editingSession !== null}
				title="Edit Session"
			>
				{editingSession && (
					<SessionForm
						currencies={currencies}
						defaultValues={buildEditDefaults(editingSession)}
						isLiveLinked={isEditLiveLinked}
						isLoading={isUpdatePending}
						onCreateTag={createTag}
						onStoreChange={setEditStoreId}
						onSubmit={handleUpdate}
						ringGames={editGames.ringGames}
						stores={stores}
						tags={availableTags}
						tournaments={editGames.tournaments}
					/>
				)}
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={setIsTagManagerOpen}
				open={isTagManagerOpen}
				title="Manage Tags"
			>
				<SessionTagManager />
			</ResponsiveDialog>
		</div>
	);
}
