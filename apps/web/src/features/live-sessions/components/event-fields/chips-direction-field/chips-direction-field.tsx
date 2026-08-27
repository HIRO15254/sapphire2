import { cn } from "@/lib/utils";

export type ChipsDirection = "add" | "remove";

interface ChipsDirectionFieldProps {
	onChange: (direction: ChipsDirection) => void;
	value: ChipsDirection;
}

const BASE_PILL =
	"h-[var(--m-control)] rounded-full border font-sans font-semibold text-sm";
const SELECTED_PILL = "border-primary bg-primary/15 text-primary";
const UNSELECTED_PILL =
	"border-border bg-transparent text-muted-foreground hover:bg-muted";

export function ChipsDirectionField({
	onChange,
	value,
}: ChipsDirectionFieldProps) {
	return (
		<div>
			<div className="mb-1.5 font-medium text-foreground text-sm">
				Direction
			</div>
			<div className="grid grid-cols-2 gap-1.5">
				<button
					aria-pressed={value === "add"}
					className={cn(
						BASE_PILL,
						value === "add" ? SELECTED_PILL : UNSELECTED_PILL
					)}
					onClick={() => onChange("add")}
					type="button"
				>
					Add chips (+)
				</button>
				<button
					aria-pressed={value === "remove"}
					className={cn(
						BASE_PILL,
						value === "remove" ? SELECTED_PILL : UNSELECTED_PILL
					)}
					onClick={() => onChange("remove")}
					type="button"
				>
					Withdraw (−)
				</button>
			</div>
		</div>
	);
}
