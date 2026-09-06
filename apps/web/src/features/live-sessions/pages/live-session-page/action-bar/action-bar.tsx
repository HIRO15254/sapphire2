import type { Icon } from "@tabler/icons-react";
import {
	IconBolt,
	IconCoin,
	IconListDetails,
	IconNote,
} from "@tabler/icons-react";

interface ActionBarItem {
	icon: Icon;
	isDisabled: boolean;
	label: string;
	onClick?: () => void;
}

const ITEMS: ActionBarItem[] = [
	{ icon: IconListDetails, isDisabled: true, label: "Timeline" },
	{ icon: IconCoin, isDisabled: true, label: "Chip adjust" },
	{ icon: IconBolt, isDisabled: true, label: "All-in" },
	{ icon: IconNote, isDisabled: true, label: "Note" },
];

export function ActionBar() {
	return (
		<nav className="grid shrink-0 grid-cols-4 gap-2 bg-card px-[var(--m-inset)] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]">
			{ITEMS.map(({ icon: ItemIcon, isDisabled, label, onClick }) => (
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
