import { IconStar, IconStarFilled } from "@tabler/icons-react";
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
		handleToggleFavorite,
		openEditFromActions,
		openDeleteFromActions,
		handleEdit,
		handleConfirmDelete,
	} = useRoomDetailPage(roomId);

	if (isLoading) {
		return (
			<div className="min-h-full bg-background text-foreground">
				<div className="p-4">
					<RoomDetailSkeleton />
				</div>
			</div>
		);
	}

	if (!room) {
		return (
			<div className="min-h-full bg-background text-foreground">
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
		<div className="min-h-full bg-background text-foreground">
			<div className="p-4">
				<TopBar onOpenActions={() => setIsActionsOpen(true)} />
				<PageHeader
					description={room.memo ?? undefined}
					heading={
						<span className="flex items-center gap-2">
							<button
								aria-label={
									room.isFavorite ? "Remove from favorites" : "Add to favorites"
								}
								className="-m-1.5 shrink-0 rounded p-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
								onClick={handleToggleFavorite}
								type="button"
							>
								{room.isFavorite ? (
									<IconStarFilled className="size-5 text-yellow-500" />
								) : (
									<IconStar className="size-5" />
								)}
							</button>
							{room.name}
						</span>
					}
				/>

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
					isFavorite={room.isFavorite}
					onDelete={openDeleteFromActions}
					onEdit={openEditFromActions}
					onOpenChange={setIsActionsOpen}
					onToggleFavorite={handleToggleFavorite}
					open={isActionsOpen}
				/>

				<FormSheet
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
