import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";

interface FilterChipProps {
	active?: boolean;
	invalid?: boolean;
	label: string;
	onClick: () => void;
	value: string;
}

/**
 * A single Notion-style filter chip: `Label: Value ⌄`. Outlined by default,
 * tinted primary when `active`, tinted destructive when `invalid`. Clicking it
 * opens the owning filter's option sheet.
 */
export function FilterChip({
	active,
	invalid,
	label,
	onClick,
	value,
}: FilterChipProps) {
	let chipClass = "";
	if (invalid) {
		chipClass = "border-destructive text-destructive";
	} else if (active) {
		chipClass = "border-primary/60 bg-primary/10 text-primary";
	}
	return (
		<Button
			className={cn("shrink-0 gap-1.5", chipClass)}
			onClick={onClick}
			size="sm"
			type="button"
			variant="outline"
		>
			<span
				className={cn(active ? "text-primary/70" : "text-muted-foreground")}
			>
				{label}:
			</span>
			<span className="font-semibold">{value}</span>
			<IconChevronDown size={14} />
		</Button>
	);
}
