import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogActionRow } from "@/components/ui/dialog-action-row";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

interface ChipPurchaseSheetProps {
	defaultChips?: number;
	defaultCost?: number;
	defaultName?: string;
	initialValues?: { name: string; cost: number; chips: number };
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (purchase: { name: string; cost: number; chips: number }) => void;
	open: boolean;
	readOnly?: boolean;
}

export function ChipPurchaseSheet({
	open,
	onOpenChange,
	defaultName,
	defaultCost,
	defaultChips,
	initialValues,
	onSubmit,
	onDelete,
	readOnly = false,
}: ChipPurchaseSheetProps) {
	const [name, setName] = useState(initialValues?.name ?? defaultName ?? "");
	const [cost, setCost] = useState(initialValues?.cost ?? defaultCost ?? 0);
	const [chips, setChips] = useState(initialValues?.chips ?? defaultChips ?? 0);

	useEffect(() => {
		if (open) {
			setName(initialValues?.name ?? defaultName ?? "");
			setCost(initialValues?.cost ?? defaultCost ?? 0);
			setChips(initialValues?.chips ?? defaultChips ?? 0);
		}
	}, [
		open,
		initialValues?.name,
		initialValues?.cost,
		initialValues?.chips,
		defaultName,
		defaultCost,
		defaultChips,
	]);

	const isEditMode = initialValues !== undefined;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit({ name, cost, chips });
	};

	let title = "Add Chip Purchase";
	if (readOnly) {
		title = name || "Chip Purchase";
	} else if (isEditMode) {
		title = "Edit Chip Purchase";
	}

	return (
		<ResponsiveDialog
			description="Add, review, or edit a chip purchase entry for this tournament stack."
			onOpenChange={onOpenChange}
			open={open}
			title={title}
		>
			<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
				<Field htmlFor="chip-purchase-name" label="Name" required>
					<Input
						disabled={readOnly}
						id="chip-purchase-name"
						onChange={(e) => setName(e.target.value)}
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
						onChange={(e) => setCost(Math.round(Number(e.target.value)))}
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
						onChange={(e) => setChips(Math.round(Number(e.target.value)))}
						required
						step={1}
						type="number"
						value={chips}
					/>
				</Field>
				<DialogActionRow>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					{onDelete ? (
						<Button onClick={onDelete} type="button" variant="destructive">
							Delete
						</Button>
					) : null}
					{readOnly ? null : (
						<Button type="submit">
							{isEditMode ? "Save" : "Add Chip Purchase"}
						</Button>
					)}
				</DialogActionRow>
			</form>
		</ResponsiveDialog>
	);
}
