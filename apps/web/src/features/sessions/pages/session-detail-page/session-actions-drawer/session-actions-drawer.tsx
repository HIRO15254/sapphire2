import { IconEdit, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
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

interface SessionActionsDrawerProps {
	/** Live-recorded cash games can be reopened back into the active tracker. */
	canReopen: boolean;
	onDelete: () => void;
	onEdit: () => void;
	onOpenChange: (open: boolean) => void;
	onReopen: () => void;
	open: boolean;
}

/**
 * v2 action sheet for the session detail header overflow: Edit / (Reopen) /
 * Delete, mirroring `PlayerActionsDrawer`. Reopen only appears for a live cash
 * game so a manual session never shows an action it can't perform.
 */
export function SessionActionsDrawer({
	canReopen,
	onDelete,
	onEdit,
	onOpenChange,
	onReopen,
	open,
}: SessionActionsDrawerProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="sr-only">Session actions</DrawerTitle>
				<DrawerDescription className="sr-only">
					Edit, reopen, or delete this session.
				</DrawerDescription>
				<ul className="flex flex-col gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
					<li>
						<button className={NEUTRAL_ITEM} onClick={onEdit} type="button">
							<IconEdit size={18} />
							Edit session
						</button>
					</li>
					{canReopen ? (
						<li>
							<button className={NEUTRAL_ITEM} onClick={onReopen} type="button">
								<IconPlayerPlay size={18} />
								Reopen in tracker
							</button>
						</li>
					) : null}
					<li>
						<button
							className={DESTRUCTIVE_ITEM}
							onClick={onDelete}
							type="button"
						>
							<IconTrash size={18} />
							Delete session
						</button>
					</li>
				</ul>
			</DrawerContent>
		</Drawer>
	);
}
