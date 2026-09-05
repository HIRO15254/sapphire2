import {
	IconArchive,
	IconArchiveOff,
	IconEdit,
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

interface GameActionsDrawerProps {
	isArchived: boolean;
	label: string;
	onArchive: () => void;
	onDelete: () => void;
	onEdit: () => void;
	onOpenChange: (open: boolean) => void;
	onRestore: () => void;
	open: boolean;
}

export function GameActionsDrawer({
	isArchived,
	label,
	onArchive,
	onDelete,
	onEdit,
	onOpenChange,
	onRestore,
	open,
}: GameActionsDrawerProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="sr-only">{label} actions</DrawerTitle>
				<DrawerDescription className="sr-only">
					Edit, archive, or delete this {label}.
				</DrawerDescription>
				<ul className="flex flex-col gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
					<li>
						<button className={NEUTRAL_ITEM} onClick={onEdit} type="button">
							<IconEdit size={18} />
							Edit {label}
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
								Restore {label}
							</button>
						) : (
							<button
								className={NEUTRAL_ITEM}
								onClick={onArchive}
								type="button"
							>
								<IconArchive size={18} />
								Archive {label}
							</button>
						)}
					</li>
					<li>
						<button
							className={DESTRUCTIVE_ITEM}
							onClick={onDelete}
							type="button"
						>
							<IconTrash size={18} />
							Delete {label}
						</button>
					</li>
				</ul>
			</DrawerContent>
		</Drawer>
	);
}
