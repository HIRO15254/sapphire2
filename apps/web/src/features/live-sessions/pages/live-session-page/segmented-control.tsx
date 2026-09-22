import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { RadioGroup } from "@/shared/components/ui/radio-group";
import { CRYST_FOCUS_RING } from "./cryst-controls";

export interface SegmentedOption<TValue extends string> {
	label: string;
	value: TValue;
}

type SegmentedControlLabel =
	| { "aria-label": string; "aria-labelledby"?: never }
	| { "aria-label"?: never; "aria-labelledby": string };

type SegmentedControlProps<TValue extends string> = SegmentedControlLabel & {
	fit?: boolean;
	onChange: (value: TValue) => void;
	options: readonly SegmentedOption<TValue>[];
	size?: "sm" | "xl";
	value: TValue;
};

const SIZE_CLASS = {
	sm: "h-7 px-2.5 text-[length:var(--text-xs)]",
	xl: "h-[var(--m-control)] px-3.5 text-[length:var(--m-text-secondary)]",
} as const;

export function SegmentedControl<TValue extends string>({
	fit = false,
	onChange,
	options,
	size = "xl",
	value,
	...labelProps
}: SegmentedControlProps<TValue>) {
	return (
		<RadioGroup
			{...labelProps}
			className={cn(
				"gap-1.5",
				fit ? "inline-flex w-auto flex-wrap" : "grid auto-cols-fr grid-flow-col"
			)}
			onValueChange={(next) => {
				const option = options.find((candidate) => candidate.value === next);
				if (option) {
					onChange(option.value);
				}
			}}
			value={value}
		>
			{options.map((option) => (
				<RadioGroupPrimitive.Item
					className={cn(
						"inline-flex min-w-0 items-center justify-center whitespace-nowrap rounded-full border border-input bg-card font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-[var(--selection)] data-[state=checked]:text-primary",
						SIZE_CLASS[size],
						CRYST_FOCUS_RING
					)}
					key={option.value}
					value={option.value}
				>
					<span className="truncate">{option.label}</span>
				</RadioGroupPrimitive.Item>
			))}
		</RadioGroup>
	);
}
