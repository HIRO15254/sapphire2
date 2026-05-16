import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";

export interface ChipPurchaseRow {
	chips: string;
	cost: string;
	name: string;
	uid: string;
}

interface ChipPurchasesEditorProps {
	onChange: (next: ChipPurchaseRow[]) => void;
	value: ChipPurchaseRow[];
}

/**
 * Controlled rebuy / add-on editor shared by the Stores tournament form
 * and the session wizard's Rules step. Each row carries a stable `uid`
 * so React keys survive edits; numeric cells stay strings (parsed by the
 * consuming form/schema) per the `inputMode="numeric"` convention.
 */
export function ChipPurchasesEditor({
	value,
	onChange,
}: ChipPurchasesEditorProps) {
	const updateAt = (index: number, patch: Partial<ChipPurchaseRow>) => {
		onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
	};
	const removeAt = (index: number) => {
		onChange(value.filter((_, i) => i !== index));
	};
	const addRow = () => {
		onChange([
			...value,
			{ uid: crypto.randomUUID(), name: "", cost: "", chips: "" },
		]);
	};

	return (
		<Field className="rounded-md border p-3" label="Chip Purchases">
			<Button onClick={addRow} size="xs" type="button" variant="outline">
				<IconPlus size={12} />
				Add
			</Button>
			{value.length > 0 && (
				<div className="flex flex-col gap-2">
					{value.map((row, idx) => (
						<div className="flex items-end gap-2" key={row.uid}>
							<Field
								className="flex flex-1 flex-col gap-1"
								htmlFor={`cp-name-${row.uid}`}
								label="Name"
							>
								<Input
									id={`cp-name-${row.uid}`}
									onChange={(e) => updateAt(idx, { name: e.target.value })}
									value={row.name}
								/>
							</Field>
							<Field
								className="flex w-24 flex-col gap-1"
								htmlFor={`cp-cost-${row.uid}`}
								label="Cost"
							>
								<Input
									id={`cp-cost-${row.uid}`}
									inputMode="numeric"
									onChange={(e) => updateAt(idx, { cost: e.target.value })}
									value={row.cost}
								/>
							</Field>
							<Field
								className="flex w-24 flex-col gap-1"
								htmlFor={`cp-chips-${row.uid}`}
								label="Chips"
							>
								<Input
									id={`cp-chips-${row.uid}`}
									inputMode="numeric"
									onChange={(e) => updateAt(idx, { chips: e.target.value })}
									value={row.chips}
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
