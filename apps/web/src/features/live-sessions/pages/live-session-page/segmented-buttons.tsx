import { cn } from "@/lib/utils";
import { CRYST_FOCUS_RING } from "./cryst-controls";

export interface SegmentedOption<TValue extends string> {
	label: string;
	value: TValue;
}

interface SegmentedButtonsProps<TValue extends string> {
	columns: 2 | 3;
	onChange: (value: TValue) => void;
	options: readonly SegmentedOption<TValue>[];
	value: TValue;
}

const COLUMNS_CLASS = {
	2: "grid-cols-2",
	3: "grid-cols-3",
} as const;

export function SegmentedButtons<TValue extends string>({
	columns,
	onChange,
	options,
	value,
}: SegmentedButtonsProps<TValue>) {
	return (
		<div className={cn("grid gap-1.5", COLUMNS_CLASS[columns])}>
			{options.map((option) => (
				<button
					aria-pressed={value === option.value}
					className={cn(
						"h-[var(--m-control)] rounded-full border font-medium text-[length:var(--text-sm)] transition-colors",
						CRYST_FOCUS_RING,
						value === option.value
							? "border-primary bg-[var(--selection)] text-primary"
							: "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
					)}
					key={option.value}
					onClick={() => onChange(option.value)}
					type="button"
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
