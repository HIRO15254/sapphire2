import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface ChipPurchaseFieldsProps {
	chips: number;
	cost: number;
	name: string;
	onChipsChange: (v: number) => void;
	onCostChange: (v: number) => void;
	onNameChange: (v: string) => void;
	readOnly?: boolean;
	shortcuts?: Array<{ chips: number; cost: number; name: string }>;
}

export function ChipPurchaseFields({
	chips,
	cost,
	name,
	onChipsChange,
	onCostChange,
	onNameChange,
	readOnly = false,
	shortcuts,
}: ChipPurchaseFieldsProps) {
	return (
		<>
			{shortcuts && shortcuts.length > 0 && !readOnly && (
				<div className="flex flex-wrap gap-2">
					{shortcuts.map((s) => (
						<Button
							key={s.name}
							onClick={() => {
								onNameChange(s.name);
								onCostChange(s.cost);
								onChipsChange(s.chips);
							}}
							size="xs"
							type="button"
							variant="outline"
						>
							{s.name}
						</Button>
					))}
				</div>
			)}
			<Field htmlFor="chip-purchase-name" label="Name" required>
				<Input
					disabled={readOnly}
					id="chip-purchase-name"
					onChange={(e) => onNameChange(e.target.value)}
					placeholder="e.g. Rebuy, Addon"
					required
					type="text"
					value={name}
				/>
			</Field>
			<Field htmlFor="chip-purchase-cost" label="Cost" required>
				<Input
					disabled={readOnly}
					id="chip-purchase-cost"
					min={0}
					onChange={(e) => onCostChange(Math.round(Number(e.target.value)))}
					required
					step={1}
					type="number"
					value={cost}
				/>
			</Field>
			<Field htmlFor="chip-purchase-chips" label="Chips Received" required>
				<Input
					disabled={readOnly}
					id="chip-purchase-chips"
					min={0}
					onChange={(e) => onChipsChange(Math.round(Number(e.target.value)))}
					required
					step={1}
					type="number"
					value={chips}
				/>
			</Field>
		</>
	);
}
