import type { ComponentType } from "react";
import { BottomSheet } from "@/shared/components/bottom-sheet";

const NEUTRAL_ITEM =
	"flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-foreground text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40";
const DESTRUCTIVE_ITEM =
	"flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-destructive text-sm outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/40";

export interface ActionsDrawerItem {
	icon: ComponentType<{ size?: number }>;
	key?: string;
	label: string;
	onSelect: () => void;
	tone?: "default" | "destructive";
}

interface ActionsDrawerProps {
	description: string;
	emptyMessage?: string;
	items: ActionsDrawerItem[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}

export function ActionsDrawer({
	description,
	emptyMessage,
	items,
	onOpenChange,
	open,
	title,
}: ActionsDrawerProps) {
	return (
		<BottomSheet
			description={description}
			onOpenChange={onOpenChange}
			open={open}
			title={title}
			variant="menu"
		>
			{items.length === 0 && emptyMessage ? (
				<p className="py-6 text-center text-muted-foreground text-sm">
					{emptyMessage}
				</p>
			) : (
				<ul className="flex flex-col gap-1">
					{items.map((item) => (
						<li key={item.key ?? item.label}>
							<button
								className={
									item.tone === "destructive" ? DESTRUCTIVE_ITEM : NEUTRAL_ITEM
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
		</BottomSheet>
	);
}
