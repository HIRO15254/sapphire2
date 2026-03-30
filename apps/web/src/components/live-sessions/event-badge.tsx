import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AllInBadgeProps {
	data: { potSize: number; trials: number; equity: number; wins: number };
	onDelete: () => void;
	onEdit: () => void;
	type: "all-in";
}

interface AddonBadgeProps {
	data: { amount: number };
	onDelete: () => void;
	onEdit: () => void;
	type: "addon";
}

type EventBadgeProps = AllInBadgeProps | AddonBadgeProps;

export function EventBadge({ type, data, onEdit, onDelete }: EventBadgeProps) {
	const [expanded, setExpanded] = useState(false);

	const label =
		type === "all-in"
			? `All-in: ${data.potSize} pot, ${data.equity}%`
			: `Addon: ${data.amount}`;

	const handleBadgeClick = () => {
		setExpanded((prev) => !prev);
	};

	const handleEdit = () => {
		setExpanded(false);
		onEdit();
	};

	const handleDelete = () => {
		setExpanded(false);
		onDelete();
	};

	return (
		<span className="inline-flex flex-wrap items-center gap-1">
			<Badge
				className={cn(
					"cursor-pointer select-none",
					type === "addon"
						? "bg-secondary text-secondary-foreground"
						: undefined
				)}
				onClick={handleBadgeClick}
				variant={type === "all-in" ? "default" : "secondary"}
			>
				{label}
			</Badge>
			{expanded && (
				<span className="inline-flex items-center gap-1">
					<Button
						aria-label="Edit"
						onClick={handleEdit}
						size="xs"
						variant="outline"
					>
						Edit
					</Button>
					<Button
						aria-label="Delete"
						onClick={handleDelete}
						size="xs"
						variant="destructive"
					>
						Delete
					</Button>
				</span>
			)}
		</span>
	);
}
