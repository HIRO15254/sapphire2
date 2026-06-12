import type { ComponentType } from "react";
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

export interface ActionsDrawerItem {
	icon: ComponentType<{ size?: number }>;
	/**
	 * Stable React key. Required when labels can repeat (e.g. a player picker
	 * with two seatless same-named players); falls back to `label` for menus
	 * whose labels are unique by construction.
	 */
	key?: string;
	label: string;
	onSelect: () => void;
	tone?: "default" | "destructive";
}

interface ActionsDrawerProps {
	description: string;
	/** Rendered instead of the list when `items` is empty. */
	emptyMessage?: string;
	items: ActionsDrawerItem[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

/**
 * v2 action sheet with a configurable item list. The live-session screens
 * compose several of these (event "+" menu, session overflow menu, player
 * picker), so the drawer chrome and item styling live here once instead of
 * one bespoke drawer per menu.
 */
export function ActionsDrawer({
	description,
	emptyMessage,
	items,
	onOpenChange,
	open,
	title,
}: ActionsDrawerProps) {
	return (
		<Drawer onOpenChange={onOpenChange} open={open}>
			<DrawerContent className="rounded-t-xl">
				<div
					aria-hidden
					className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/35"
				/>
				<DrawerTitle className="sr-only">{title}</DrawerTitle>
				<DrawerDescription className="sr-only">{description}</DrawerDescription>
				{items.length === 0 && emptyMessage ? (
					<p className="px-5 py-6 text-center text-muted-foreground text-sm">
						{emptyMessage}
					</p>
				) : (
					<ul className="flex flex-col gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
						{items.map((item) => (
							<li key={item.key ?? item.label}>
								<button
									className={
										item.tone === "destructive"
											? DESTRUCTIVE_ITEM
											: NEUTRAL_ITEM
									}
									onClick={item.onSelect}
									type="button"
								>
									<item.icon size={18} />
									{item.label}
								</button>
							</li>
						))}
					</ul>
				)}
			</DrawerContent>
		</Drawer>
	);
}
