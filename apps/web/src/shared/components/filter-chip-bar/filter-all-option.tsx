import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface FilterAllOptionProps {
	active: boolean;
	label: string;
	onClick: () => void;
}

/**
 * The "clear this filter" row rendered above a {@link FilterOptionList} for
 * optional dimensions (e.g. `All rooms` / `All currencies`). A `RadioGroup`
 * can't carry an empty-string item cleanly, so the cleared state lives in this
 * sibling button instead. Tinted primary with a trailing check when `active`.
 */
export function FilterAllOption({
	active,
	label,
	onClick,
}: FilterAllOptionProps) {
	return (
		<button
			className={cn(
				"flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted",
				active && "bg-primary/10"
			)}
			onClick={onClick}
			type="button"
		>
			<span className={cn("font-medium text-sm", active && "text-primary")}>
				{label}
			</span>
			{active ? <IconCheck className="size-4 text-primary" /> : null}
		</button>
	);
}
