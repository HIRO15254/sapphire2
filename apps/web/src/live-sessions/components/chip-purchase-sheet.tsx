import { useEffect, useState } from "react";
import { ChipPurchaseFields } from "@/live-sessions/components/event-fields/chip-purchase-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

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
	shortcuts?: Array<{ chips: number; cost: number; name: string }>;
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
	shortcuts,
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
				<ChipPurchaseFields
					chips={chips}
					cost={cost}
					name={name}
					onChipsChange={setChips}
					onCostChange={setCost}
					onNameChange={setName}
					readOnly={readOnly}
					shortcuts={shortcuts}
				/>
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
