import type { Icon } from "@tabler/icons-react";
import {
	IconBolt,
	IconCoin,
	IconListDetails,
	IconNote,
	IconShoppingCart,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ActionBarItem {
	icon: Icon;
	isDisabled: boolean;
	label: string;
	onClick?: () => void;
}

const CASH_ITEMS: ActionBarItem[] = [
	{ icon: IconListDetails, isDisabled: true, label: "Timeline" },
	{ icon: IconCoin, isDisabled: true, label: "Chip adjust" },
	{ icon: IconBolt, isDisabled: true, label: "All-in" },
	{ icon: IconNote, isDisabled: true, label: "Note" },
];

const TOURNAMENT_ITEMS: ActionBarItem[] = [
	{ icon: IconListDetails, isDisabled: true, label: "Timeline" },
	{ icon: IconShoppingCart, isDisabled: true, label: "Chip purchase" },
	{ icon: IconNote, isDisabled: true, label: "Note" },
];

export function ActionBar({ variant }: { variant: "cash" | "tournament" }) {
	const items = variant === "cash" ? CASH_ITEMS : TOURNAMENT_ITEMS;

	return (
		<nav
			className={cn(
				"grid shrink-0 gap-2 bg-card px-[var(--m-inset)] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]",
				variant === "cash" ? "grid-cols-4" : "grid-cols-3"
			)}
		>
			{items.map(({ icon: ItemIcon, isDisabled, label, onClick }) => (
				<button
					className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border border-border font-medium text-[11px] disabled:opacity-40"
					disabled={isDisabled}
					key={label}
					onClick={onClick}
					type="button"
				>
					<ItemIcon size={18} />
					{label}
				</button>
			))}
		</nav>
	);
}
