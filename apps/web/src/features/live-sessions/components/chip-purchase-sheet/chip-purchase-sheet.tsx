import { ChipPurchaseFields } from "@/features/live-sessions/components/event-fields/chip-purchase-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { useChipPurchaseForm } from "./use-chip-purchase-form";

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
	const { form } = useChipPurchaseForm({
		defaultChips,
		defaultCost,
		defaultName,
		initialValues,
		open,
		onSubmit,
	});

	const isEditMode = initialValues !== undefined;

	let title = "Add Chip Purchase";
	if (readOnly) {
		title = form.state.values.name || "Chip Purchase";
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
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(nameField) => (
						<form.Field name="cost">
							{(costField) => (
								<form.Field name="chips">
									{(chipsField) => (
										<ChipPurchaseFields
											chips={chipsField.state.value}
											chipsError={chipsField.state.meta.errors[0]?.message}
											cost={costField.state.value}
											costError={costField.state.meta.errors[0]?.message}
											name={nameField.state.value}
											nameError={nameField.state.meta.errors[0]?.message}
											onChipsChange={(v) => chipsField.handleChange(v)}
											onCostChange={(v) => costField.handleChange(v)}
											onNameChange={(v) => nameField.handleChange(v)}
											readOnly={readOnly}
											shortcuts={shortcuts}
										/>
									)}
								</form.Field>
							)}
						</form.Field>
					)}
				</form.Field>
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
