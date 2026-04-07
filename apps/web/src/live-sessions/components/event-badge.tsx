import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/lib/utils";

interface AllInBadgeProps {
	data: { potSize: number; trials: number; equity: number; wins: number };
	onEdit: () => void;
	type: "all-in";
}

interface AddonBadgeProps {
	data: { amount: number };
	onEdit: () => void;
	type: "addon";
}

interface ChipPurchaseBadgeProps {
	data: { name: string; cost: number; chips: number };
	onEdit: () => void;
	type: "chip-purchase";
}

type EventBadgeProps =
	| AllInBadgeProps
	| AddonBadgeProps
	| ChipPurchaseBadgeProps;

function getLabel(props: EventBadgeProps): string {
	switch (props.type) {
		case "all-in":
			return `All-in: ${props.data.potSize} pot, ${props.data.equity}%`;
		case "addon":
			return `Addon: ${props.data.amount}`;
		case "chip-purchase":
			return `${props.data.name}: ${props.data.cost}`;
		default: {
			const _exhaustive: never = props;
			return String((_exhaustive as EventBadgeProps).type);
		}
	}
}

export function EventBadge(props: EventBadgeProps) {
	const label = getLabel(props);
	const isSecondary = props.type !== "all-in";

	return (
		<Badge
			className={cn(
				"cursor-pointer select-none",
				isSecondary ? "bg-secondary text-secondary-foreground" : undefined
			)}
			onClick={props.onEdit}
			variant={isSecondary ? "secondary" : "default"}
		>
			{label}
		</Badge>
	);
}
