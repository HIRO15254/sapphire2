import { IconPlus } from "@tabler/icons-react";
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
		isLoading,
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
					isLoading={isLoading}
					onCreate={() => setIsCreateOpen(true)}
					onToggleFavorite={handleToggleFavorite}
					rooms={rooms}
				/>

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
