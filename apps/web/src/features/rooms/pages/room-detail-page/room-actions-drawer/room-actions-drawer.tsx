import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
	IconStar,
	IconStarFilled,
	IconTrash,
} from "@tabler/icons-react";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerTitle,
} from "@/shared/components/ui/drawer";

const NEUTRAL_ITEM =
	"flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-foreground text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40";
const DESTRUCTIVE_ITEM =
	"flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-destructive text-sm outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/40";

interface RoomActionsDrawerProps {
	canDelete: boolean;
	isArchived: boolean;
	isFavorite: boolean;
	onArchive: () => void;
	onDelete: () => void;
	onEdit: () => void;
	onOpenChange: (open: boolean) => void;
	onRestore: () => void;
	onToggleFavorite: () => void;
	open: boolean;
}

export function RoomActionsDrawer({
	canDelete,
	isArchived,
	onArchive,
	onRestore,
	isFavorite,
	onDelete,
	onEdit,
	onOpenChange,
	onToggleFavorite,
	open,
}: RoomActionsDrawerProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="sr-only">Room actions</DrawerTitle>
				<DrawerDescription className="sr-only">
					Edit, archive, restore, or delete this room.
				</DrawerDescription>
				<ul className="flex flex-col gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
					<li>
						<button
							className={NEUTRAL_ITEM}
							onClick={onToggleFavorite}
							type="button"
						>
							{isFavorite ? (
								<IconStarFilled className="text-yellow-500" size={18} />
							) : (
								<IconStar size={18} />
							)}
							{isFavorite ? "Remove from favorites" : "Add to favorites"}
						</button>
					</li>
					<li>
						<button className={NEUTRAL_ITEM} onClick={onEdit} type="button">
							<IconEdit size={18} />
							Edit room
						</button>
					</li>
					<li>
						{isArchived ? (
							<button
								className={NEUTRAL_ITEM}
								onClick={onRestore}
								type="button"
							>
								<IconArchiveOff size={18} />
								Restore room
							</button>
						) : (
							<button
								className={NEUTRAL_ITEM}
								onClick={onArchive}
								type="button"
							>
								<IconArchive size={18} />
								Archive room
							</button>
						)}
					</li>
					{canDelete ? (
						<li>
							<button
								className={DESTRUCTIVE_ITEM}
								onClick={onDelete}
								type="button"
							>
								<IconTrash size={18} />
								Delete room
							</button>
						</li>
					) : null}
				</ul>
			</DrawerContent>
		</Drawer>
	);
}
