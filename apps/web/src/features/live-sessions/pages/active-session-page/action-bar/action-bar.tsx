import {
	type Icon,
	IconBolt,
	IconCoin,
	IconListDetails,
	IconNote,
	IconShoppingCart,
} from "@tabler/icons-react";

export interface ActionBarProps {
	dimmed: boolean;
	kind: "cash_game" | "tournament";
	onAllIn: () => void;
	onChips: () => void;
	onNote: () => void;
	onPurchase: () => void;
	onTimeline: () => void;
}

interface ActionBarItem {
	dimmable: boolean;
	Icon: Icon;
	label: string;
	onSelect: () => void;
}

function buildItems(props: ActionBarProps): ActionBarItem[] {
	const timeline: ActionBarItem = {
		Icon: IconListDetails,
		dimmable: false,
		label: "Timeline",
		onSelect: props.onTimeline,
	};
	const note: ActionBarItem = {
		Icon: IconNote,
		dimmable: false,
		label: "Note",
		onSelect: props.onNote,
	};
	if (props.kind === "tournament") {
		return [
			timeline,
			{
				Icon: IconShoppingCart,
				dimmable: true,
				label: "Chip purchase",
				onSelect: props.onPurchase,
			},
			note,
		];
	}
	return [
		timeline,
		{
			Icon: IconCoin,
			dimmable: true,
			label: "Chip adjust",
			onSelect: props.onChips,
		},
		{
			Icon: IconBolt,
			dimmable: true,
			label: "All-in",
			onSelect: props.onAllIn,
		},
		note,
	];
}

export function ActionBar(props: ActionBarProps) {
	const items = buildItems(props);
	return (
		<div
			className="grid gap-2 bg-card px-[var(--m-inset)] pt-2 pb-[calc(8px+env(safe-area-inset-bottom))]"
			style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
		>
			{items.map(({ Icon, dimmable, label, onSelect }) => {
				const disabled = dimmable && props.dimmed;
				return (
					<button
						className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-transparent font-medium text-[11px] text-foreground hover:bg-muted disabled:opacity-50"
						disabled={disabled}
						key={label}
						onClick={onSelect}
						type="button"
					>
						<Icon className="size-4.5" />
						{label}
					</button>
				);
			})}
		</div>
	);
}
