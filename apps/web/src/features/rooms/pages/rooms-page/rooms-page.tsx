import { IconArchive, IconArchiveOff, IconPlus } from "@tabler/icons-react";
import { RoomForm } from "@/features/rooms/components/room-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { RoomList } from "./room-list";
import { useRoomsPage } from "./use-rooms-page";

const CREATE_FORM_ID = "room-create-form";

export function RoomsPage() {
	const {
		rooms,
		archivedRooms,
		archivedLoading,
		isArchivedError,
		onRetryArchived,
		showArchived,
		toggleArchived,
		isLoading,
		isError,
		onRetry,
		isCreateOpen,
		isCreatePending,
		setIsCreateOpen,
		handleCreate,
		handleToggleFavorite,
	} = useRoomsPage();

	return (
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<PageHeader
					actions={
						<Button onClick={() => setIsCreateOpen(true)} size="sm">
							<IconPlus size={16} />
							New room
						</Button>
					}
					heading="Rooms"
				/>

				<RoomList
					hideEmpty={showArchived}
					isError={isError}
					isLoading={isLoading}
					onCreate={() => setIsCreateOpen(true)}
					onRetry={onRetry}
					onToggleFavorite={handleToggleFavorite}
					rooms={rooms}
				/>
				{showArchived ? (
					<div className="mt-3 flex flex-col gap-2 border-border border-t border-dashed pt-3">
						<p className="t-meta uppercase tracking-wide">Archived</p>
						<RoomList
							isArchived
							isError={isArchivedError}
							isLoading={archivedLoading}
							onCreate={() => setIsCreateOpen(true)}
							onRetry={onRetryArchived}
							onToggleFavorite={handleToggleFavorite}
							rooms={archivedRooms}
						/>
					</div>
				) : null}
				<div className="mt-3 flex justify-center">
					<Button
						className="text-muted-foreground"
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
				</div>

				<FormSheet
					formId={CREATE_FORM_ID}
					isLoading={isCreatePending}
					onOpenChange={setIsCreateOpen}
					open={isCreateOpen}
					title="New room"
				>
					<RoomForm formId={CREATE_FORM_ID} onSubmit={handleCreate} />
				</FormSheet>
			</div>
		</div>
	);
}
