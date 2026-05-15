import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { SessionChipPurchaseInput } from "@/features/sessions/utils/session-form-helpers";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

interface ChipPurchasesInlineTableProps {
	onChange: (next: SessionChipPurchaseInput[]) => void;
	value: SessionChipPurchaseInput[];
}

function parseIntOrZero(value: string): number {
	if (value === "") {
		return 0;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function ChipPurchasesInlineTable({
	value,
	onChange,
}: ChipPurchasesInlineTableProps) {
	const updateAt = (
		index: number,
		patch: Partial<SessionChipPurchaseInput>
	) => {
		onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	};
	const removeAt = (index: number) => {
		onChange(value.filter((_, i) => i !== index));
	};
	const addRow = () => {
		onChange([...value, { name: "", cost: 0, chips: 0 }]);
	};

	return (
		<Field
			className="rounded-md border p-3"
			description="Define rebuy or addon options available during play."
			label="Chip Purchases"
		>
			<Button onClick={addRow} size="xs" type="button" variant="outline">
				<IconPlus size={12} />
				Add
			</Button>
			{value.length > 0 && (
				<div className="flex flex-col gap-2">
					{value.map((row, idx) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: chip purchases carry no stable id; their position IS their identity.
						<div className="flex items-end gap-2" key={`cp-${idx}`}>
							<Field
								className="flex flex-1 flex-col gap-1"
								htmlFor={`cp-name-${idx}`}
								label="Name"
							>
								<Input
									id={`cp-name-${idx}`}
									onChange={(e) => updateAt(idx, { name: e.target.value })}
									value={row.name}
								/>
							</Field>
							<Field
								className="flex w-24 flex-col gap-1"
								htmlFor={`cp-cost-${idx}`}
								label="Cost"
							>
								<Input
									id={`cp-cost-${idx}`}
									inputMode="numeric"
									onChange={(e) =>
										updateAt(idx, { cost: parseIntOrZero(e.target.value) })
									}
									value={row.cost === 0 ? "" : String(row.cost)}
								/>
							</Field>
							<Field
								className="flex w-24 flex-col gap-1"
								htmlFor={`cp-chips-${idx}`}
								label="Chips"
							>
								<Input
									id={`cp-chips-${idx}`}
									inputMode="numeric"
									onChange={(e) =>
										updateAt(idx, { chips: parseIntOrZero(e.target.value) })
									}
									value={row.chips === 0 ? "" : String(row.chips)}
								/>
							</Field>
							<Button
								aria-label={`Remove chip purchase ${idx + 1}`}
								onClick={() => removeAt(idx)}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<IconTrash size={12} />
							</Button>
						</div>
					))}
				</div>
			)}
		</Field>
	);
}
