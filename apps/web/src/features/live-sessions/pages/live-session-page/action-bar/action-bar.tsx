import type { Icon } from "@tabler/icons-react";
import {
	IconBolt,
	IconCoin,
	IconListDetails,
	IconNote,
	IconShoppingCart,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { LoggableKind } from "../use-session-journal";

interface ActionBarItem {
	icon: Icon;
	kind: LoggableKind | null;
	label: string;
}

const CASH_ITEMS: ActionBarItem[] = [
	{ icon: IconListDetails, kind: null, label: "Timeline" },
	{ icon: IconCoin, kind: "chips", label: "Chip adjust" },
	{ icon: IconBolt, kind: "allin", label: "All-in" },
	{ icon: IconNote, kind: "memo", label: "Note" },
];

const TOURNAMENT_ITEMS: ActionBarItem[] = [
	{ icon: IconListDetails, kind: null, label: "Timeline" },
	{ icon: IconShoppingCart, kind: "purchase", label: "Chip purchase" },
	{ icon: IconNote, kind: "memo", label: "Note" },
];

interface ActionBarProps {
	canLog: Record<LoggableKind, boolean>;
	onOpenNewEvent: (kind: LoggableKind) => void;
	onOpenTimeline: () => void;
	variant: "cash" | "tournament";
}

export function ActionBar({
	canLog,
	onOpenNewEvent,
	onOpenTimeline,
	variant,
}: ActionBarProps) {
	const items = variant === "cash" ? CASH_ITEMS : TOURNAMENT_ITEMS;

	return (
		<nav
			className={cn(
				"grid shrink-0 gap-2 bg-card px-[var(--m-inset)] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]",
				variant === "cash" ? "grid-cols-4" : "grid-cols-3"
			)}
		>
			{items.map(({ icon: ItemIcon, kind, label }) => (
				<button
					className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border border-border font-medium text-[11px] disabled:opacity-40"
					disabled={kind !== null && !canLog[kind]}
					key={label}
					onClick={() =>
						kind === null ? onOpenTimeline() : onOpenNewEvent(kind)
					}
					type="button"
				>
					<ItemIcon size={18} />
					{label}
				</button>
			))}
		</nav>
	);
}
