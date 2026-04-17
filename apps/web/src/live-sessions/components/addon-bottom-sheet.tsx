import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";
import { AddonFields } from "@/live-sessions/components/event-fields/addon-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import { requiredNumericString } from "@/shared/lib/form-fields";

interface AddonBottomSheetProps {
	initialAmount?: number;
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (addon: { amount: number }) => void;
	open: boolean;
}

const addonSchema = z.object({
	amount: requiredNumericString({ integer: true, min: 0 }),
});

export function AddonBottomSheet({
	open,
	onOpenChange,
	initialAmount,
	onSubmit,
	onDelete,
}: AddonBottomSheetProps) {
	const form = useForm({
		defaultValues: {
			amount: initialAmount === undefined ? "0" : String(initialAmount),
		},
		onSubmit: ({ value }) => {
			onSubmit({ amount: Math.round(Number(value.amount)) });
		},
		validators: {
			onSubmit: addonSchema,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset({
				amount: initialAmount === undefined ? "0" : String(initialAmount),
			});
		}
	}, [open, initialAmount, form]);

	const isEditMode = initialAmount !== undefined;

	return (
		<ResponsiveDialog
			description="Add or edit an addon amount for this stack update."
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit Addon" : "Add Addon"}
		>
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="amount">
					{(field) => (
						<AddonFields
							error={field.state.meta.errors[0]?.message}
							onAmountChange={(v) => field.handleChange(v)}
							value={field.state.value}
						/>
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
					<Button type="submit">{isEditMode ? "Save" : "Add Addon"}</Button>
				</DialogActionRow>
			</form>
		</ResponsiveDialog>
	);
}
