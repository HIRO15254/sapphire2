import type { ChipPurchaseRow } from "@/shared/components/chip-purchases-editor";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { parseOptionalInt } from "@/shared/lib/form-fields";

function parseCountInput(value: string): number {
	const parsed = parseOptionalInt(value);
	return parsed !== undefined && parsed > 0 ? parsed : 0;
}

/**
 * One row of the chip-purchase result list: the rule's name + cost on the
 * left, a numeric purchase-count input, and the derived line cost
 * (count × cost). Presentational — all state lives in the wizard hook.
 */
export function ChipPurchaseCountRow({
	row,
	count,
	disabled,
	onCountChange,
}: {
	count: number;
	disabled: boolean;
	onCountChange: (count: number) => void;
	row: ChipPurchaseRow;
}) {
	const unitCost = parseOptionalInt(row.cost);
	const cost = unitCost !== undefined && unitCost >= 0 ? unitCost : 0;
	const lineCost = cost * count;
	return (
		<div className="flex items-end gap-2">
			<Field
				className="flex flex-1 flex-col gap-1"
				htmlFor={`cpc-${row.uid}`}
				label={row.name || "Chip purchase"}
			>
				<Input
					disabled={disabled}
					id={`cpc-${row.uid}`}
					inputMode="numeric"
					onChange={(e) => onCountChange(parseCountInput(e.target.value))}
					value={count === 0 ? "" : String(count)}
				/>
			</Field>
			<span className="pb-2 text-muted-foreground text-sm">
				× {cost} = {lineCost}
			</span>
		</div>
	);
}
