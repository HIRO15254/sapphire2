import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface FilterDateRangeProps {
	/** Lower bound as a `yyyy-mm-dd` value for the native date input. */
	from: string;
	onFromChange: (value: string) => void;
	onToChange: (value: string) => void;
	/** Upper bound as a `yyyy-mm-dd` value for the native date input. */
	to: string;
}

/**
 * The custom From / To date-range picker shown inside the Period filter sheet,
 * laid out side by side. Built from the project's standard form primitives
 * (`Field` + `Input`) so it matches forms elsewhere in the app. Values are
 * formatted `yyyy-mm-dd` strings; epoch conversion stays with each caller.
 */
export function FilterDateRange({
	from,
	onFromChange,
	onToChange,
	to,
}: FilterDateRangeProps) {
	return (
		<div className="flex items-start gap-2">
			<Field className="flex-1" htmlFor="filter-date-from" label="From">
				<Input
					id="filter-date-from"
					onChange={(event) => onFromChange(event.target.value)}
					type="date"
					value={from}
				/>
			</Field>
			<Field className="flex-1" htmlFor="filter-date-to" label="To">
				<Input
					id="filter-date-to"
					onChange={(event) => onToChange(event.target.value)}
					type="date"
					value={to}
				/>
			</Field>
		</div>
	);
}
