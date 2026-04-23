import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface ChipPurchaseFieldsProps {
	chips: string;
	chipsError?: string;
	cost: string;
	costError?: string;
	name: string;
	nameError?: string;
	onChipsChange: (value: string) => void;
	onCostChange: (value: string) => void;
	onNameChange: (value: string) => void;
	readOnly?: boolean;
	shortcuts?: Array<{ chips: number; cost: number; name: string }>;
}

export function ChipPurchaseFields({
	chips,
	chipsError,
	cost,
	costError,
	name,
	nameError,
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
								onCostChange(String(s.cost));
								onChipsChange(String(s.chips));
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
			<Field
				error={nameError}
				htmlFor="chip-purchase-name"
				label="Name"
				required
			>
				<Input
					disabled={readOnly}
					id="chip-purchase-name"
					onChange={(e) => onNameChange(e.target.value)}
					type="text"
					value={name}
				/>
			</Field>
			<Field
				error={costError}
				htmlFor="chip-purchase-cost"
				label="Cost"
				required
			>
				<Input
					disabled={readOnly}
					id="chip-purchase-cost"
					inputMode="numeric"
					onChange={(e) => onCostChange(e.target.value)}
					value={cost}
				/>
			</Field>
			<Field
				error={chipsError}
				htmlFor="chip-purchase-chips"
				label="Chips Received"
				required
			>
				<Input
					disabled={readOnly}
					id="chip-purchase-chips"
					inputMode="numeric"
					onChange={(e) => onChipsChange(e.target.value)}
					value={chips}
				/>
			</Field>
		</>
	);
}
