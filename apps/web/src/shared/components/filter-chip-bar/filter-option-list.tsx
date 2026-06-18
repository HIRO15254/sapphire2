import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";

interface FilterOptionListProps {
	idPrefix?: string;
	onChange: (value: string) => void;
	options: { label: string; value: string }[];
	value: string;
}

/**
 * The single-select option list rendered inside a {@link FilterSheet}: a
 * `RadioGroup` of full-width rows, the selected row tinted primary with a
 * trailing check. Shared by the stats and sessions filter bars.
 */
export function FilterOptionList({
	idPrefix = "filter-option",
	onChange,
	options,
	value,
}: FilterOptionListProps) {
	return (
		<RadioGroup className="gap-1" onValueChange={onChange} value={value}>
			{options.map((option) => {
				const id = `${idPrefix}-${option.value}`;
				const selected = option.value === value;
				return (
					<label
						className={cn(
							"flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-muted",
							selected && "bg-primary/10"
						)}
						htmlFor={id}
						key={option.value}
					>
						<span className="flex items-center gap-3">
							<RadioGroupItem id={id} value={option.value} />
							<span
								className={cn(
									"font-medium text-sm",
									selected && "text-primary"
								)}
							>
								{option.label}
							</span>
						</span>
						{selected ? <IconCheck className="size-4 text-primary" /> : null}
					</label>
				);
			})}
		</RadioGroup>
	);
}
