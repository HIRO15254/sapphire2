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

type EventBadgeProps = AllInBadgeProps | AddonBadgeProps;

export function EventBadge({ type, data, onEdit }: EventBadgeProps) {
	const label =
		type === "all-in"
			? `All-in: ${data.potSize} pot, ${data.equity}%`
			: `Addon: ${data.amount}`;

	return (
		<Badge
			className={cn(
				"cursor-pointer select-none",
				type === "addon" ? "bg-secondary text-secondary-foreground" : undefined
			)}
			onClick={onEdit}
			variant={type === "all-in" ? "default" : "secondary"}
		>
			{label}
		</Badge>
	);
}
