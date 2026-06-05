import { DeleteRoomDialog } from "@/features/rooms/components/delete-room-dialog";
import { RingGameTab } from "@/features/rooms/components/ring-game-tab";
import { RoomActionsDrawer } from "@/features/rooms/components/room-actions-drawer";
import { RoomForm } from "@/features/rooms/components/room-form";
import { TournamentTab } from "@/features/rooms/components/tournament-tab";
import { FormSheet } from "@/shared/components/form-sheet";
import { PageHeader } from "@/shared/components/page-header";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/shared/components/ui/tabs";
import { RoomDetailSkeleton } from "./room-detail-skeleton";
import { TopBar } from "./top-bar";
import { useRoomDetailPage } from "./use-room-detail-page";

const EDIT_STORE_FORM_ID = "room-edit-form";

interface RoomDetailPageProps {
	roomId: string;
}

export function RoomDetailPage({ roomId }: RoomDetailPageProps) {
	const {
		room,
		isLoading,
		isUpdatePending,
		isActionsOpen,
		isEditOpen,
		confirmingDelete,
		setIsActionsOpen,
		setIsEditOpen,
		setConfirmingDelete,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
	} = useRoomDetailPage(roomId);

	if (isLoading) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="p-4">
					<RoomDetailSkeleton />
				</div>
			</div>
		);
	}

	if (!room) {
		return (
			<div className="theme-v2 min-h-full bg-background text-foreground">
				<div className="p-4">
					<TopBar />
					<PageHeader heading="Room not found" />
					<p className="py-16 text-center text-muted-foreground text-sm">
						This room may have been deleted.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="theme-v2 min-h-full bg-background text-foreground">
			<div className="p-4">
				<TopBar onOpenActions={() => setIsActionsOpen(true)} />
				<PageHeader description={room.memo ?? undefined} heading={room.name} />

				<Tabs defaultValue="ring-games">
					<TabsList className="w-full">
						<TabsTrigger value="ring-games">Cash games</TabsTrigger>
						<TabsTrigger value="tournaments">Tournaments</TabsTrigger>
					</TabsList>
					<TabsContent value="ring-games">
						<RingGameTab roomId={roomId} />
					</TabsContent>
					<TabsContent value="tournaments">
						<TournamentTab roomId={roomId} />
					</TabsContent>
				</Tabs>

				<RoomActionsDrawer
					onDelete={openDeleteFromActions}
					onEdit={openEditFromActions}
					onOpenChange={setIsActionsOpen}
					open={isActionsOpen}
				/>

				<FormSheet
					contentClassName="theme-v2"
					formId={EDIT_STORE_FORM_ID}
					isLoading={isUpdatePending}
					onOpenChange={setIsEditOpen}
					open={isEditOpen}
					title="Edit room"
				>
					<RoomForm
						defaultValues={{
							name: room.name,
							memo: room.memo ?? undefined,
						}}
						formId={EDIT_STORE_FORM_ID}
						onSubmit={handleEdit}
					/>
				</FormSheet>

				<DeleteRoomDialog
					onConfirm={handleConfirmDelete}
					onOpenChange={setConfirmingDelete}
					open={confirmingDelete}
					roomName={room.name}
				/>
			</div>
		</div>
	);
}
