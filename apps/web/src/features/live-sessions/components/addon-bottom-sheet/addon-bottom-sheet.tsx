import { AddonFields } from "@/features/live-sessions/components/event-fields/addon-fields";
import { FormSheet } from "@/shared/components/form-sheet";
import { Button } from "@/shared/components/ui/button";
import { useAddonForm } from "./use-addon-form";

const ADDON_FORM_ID = "addon-form";

interface AddonBottomSheetProps {
	initialAmount?: number;
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (addon: { amount: number }) => void;
	open: boolean;
}

/**
 * V2 form sheet for adding / editing an addon amount. The FormSheet toolbar
 * submits the inner form via `formId`; the optional destructive Delete action
 * stays in the body below the fields.
 */
export function AddonBottomSheet({
	open,
	onOpenChange,
	initialAmount,
	onSubmit,
	onDelete,
}: AddonBottomSheetProps) {
	const { form } = useAddonForm({ initialAmount, open, onSubmit });

	const isEditMode = initialAmount !== undefined;

	return (
		<FormSheet
			formId={ADDON_FORM_ID}
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit Addon" : "Add Addon"}
		>
			<form
				className="flex flex-col gap-4"
				id={ADDON_FORM_ID}
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
				{onDelete ? (
					<Button onClick={onDelete} type="button" variant="destructive">
						Delete
					</Button>
				) : null}
			</form>
		</FormSheet>
	);
}
