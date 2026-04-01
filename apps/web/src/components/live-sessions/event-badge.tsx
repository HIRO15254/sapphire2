import { Badge } from "@/components/ui/badge";
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

interface RebuyBadgeProps {
	data: { cost: number; chips: number };
	onEdit: () => void;
	type: "rebuy";
}

interface TournamentAddonBadgeProps {
	data: { cost: number; chips: number };
	onEdit: () => void;
	type: "tournament-addon";
}

type EventBadgeProps =
	| AllInBadgeProps
	| AddonBadgeProps
	| RebuyBadgeProps
	| TournamentAddonBadgeProps;

function getLabel(props: EventBadgeProps): string {
	switch (props.type) {
		case "all-in":
			return `All-in: ${props.data.potSize} pot, ${props.data.equity}%`;
		case "addon":
			return `Addon: ${props.data.amount}`;
		case "rebuy":
			return `Rebuy: ${props.data.cost}`;
		case "tournament-addon":
			return `Addon: ${props.data.cost}`;
		default:
			return props.type;
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
