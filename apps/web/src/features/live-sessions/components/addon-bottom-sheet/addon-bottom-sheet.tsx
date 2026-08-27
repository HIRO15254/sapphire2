import { IconTrash } from "@tabler/icons-react";
import { AddonFields } from "@/features/live-sessions/components/event-fields/addon-fields";
import { FormSheet } from "@/shared/components/form-sheet";
import { useAddonForm } from "./use-addon-form";

const ADDON_FORM_ID = "addon-form";

interface AddonBottomSheetProps {
	initialAmount?: number;
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (addon: { amount: number }) => void;
	open: boolean;
	sheetClassName?: string;
}

export function AddonBottomSheet({
	open,
	onOpenChange,
	initialAmount,
	onSubmit,
	onDelete,
	sheetClassName,
}: AddonBottomSheetProps) {
	const { form } = useAddonForm({ initialAmount, open, onSubmit });

	const isEditMode = initialAmount !== undefined;

	return (
		<FormSheet
			contentClassName={sheetClassName}
			formId={ADDON_FORM_ID}
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit Addon" : "Add Addon"}
		>
			<form
				className="flex flex-col gap-3"
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
					<div className="mt-1 border-border border-t pt-3">
						<button
							className="inline-flex min-h-[var(--m-control)] w-full items-center justify-center gap-1.5 rounded-md border border-destructive bg-transparent font-medium text-destructive text-sm hover:bg-destructive/12"
							onClick={onDelete}
							type="button"
						>
							<IconTrash size={15} />
							Delete this event
						</button>
					</div>
				) : null}
			</form>
		</FormSheet>
	);
}
