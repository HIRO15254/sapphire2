import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface FilterDateRangeProps {
	from: string;
	idPrefix?: string;
	onFromChange: (value: string) => void;
	onToChange: (value: string) => void;
	to: string;
}

export function FilterDateRange({
	from,
	idPrefix = "filter-date",
	onFromChange,
	onToChange,
	to,
}: FilterDateRangeProps) {
	const fromId = `${idPrefix}-from`;
	const toId = `${idPrefix}-to`;
	return (
		<div className="flex items-start gap-2">
			<Field className="flex-1" htmlFor={fromId} label="From">
				<Input
					id={fromId}
					onChange={(event) => onFromChange(event.target.value)}
					type="date"
					value={from}
				/>
			</Field>
			<Field className="flex-1" htmlFor={toId} label="To">
				<Input
					id={toId}
					onChange={(event) => onToChange(event.target.value)}
					type="date"
					value={to}
				/>
			</Field>
		</div>
	);
}
