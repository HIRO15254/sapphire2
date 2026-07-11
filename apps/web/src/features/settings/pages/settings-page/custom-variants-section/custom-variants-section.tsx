import { IconEdit, IconTrash } from "@tabler/icons-react";
import { FormSheet } from "@/shared/components/form-sheet";
import { Button } from "@/shared/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
	type CustomVariantRow,
	useCustomVariantsSection,
} from "./use-custom-variants-section";

const EDIT_VARIANT_FORM_ID = "edit-custom-variant-form";

const BLIND_LABEL_FIELDS = [
	{ name: "blind1Label", label: "Blind 1 label" },
	{ name: "blind2Label", label: "Blind 2 label" },
	{ name: "blind3Label", label: "Blind 3 label" },
] as const;

function blindLabelsSummary(variant: CustomVariantRow): string {
	const labels = [
		variant.blind1Label,
		variant.blind2Label,
		variant.blind3Label,
	].filter(Boolean);
	return labels.length > 0 ? labels.join(" / ") : "Default blind labels";
}

/**
 * Settings section listing the user's custom game variants with edit and
 * delete actions. Creation happens inline from any Variant select ("Add
 * custom variant"); this is the one place to rename or remove definitions.
 * Past sessions and games keep the frozen label string either way.
 */
export function CustomVariantsSection() {
	const {
		variants,
		isLoading,
		form,
		editingVariant,
		onEdit,
		onEditOpenChange,
		isUpdatePending,
		deletingVariant,
		onDeleteRequest,
		onDeleteConfirm,
		onDeleteCancel,
		isDeletePending,
	} = useCustomVariantsSection();

	if (isLoading) {
		return (
			<p className="py-4 text-center text-muted-foreground text-sm">
				Loading variants...
			</p>
		);
	}

	return (
		<>
			{variants.length === 0 ? (
				<p className="py-4 text-muted-foreground text-sm">
					No custom variants yet. Create one from the Variant select in any game
					form.
				</p>
			) : (
				<div className="divide-y rounded-md border">
					{variants.map((variant) => (
						<div
							className="flex items-center justify-between gap-2 px-3 py-2"
							key={variant.id}
						>
							<div className="min-w-0">
								<p className="truncate font-medium text-sm">{variant.label}</p>
								<p className="truncate text-muted-foreground text-xs">
									{blindLabelsSummary(variant)}
								</p>
							</div>
							<div className="flex shrink-0 gap-1">
								<Button
									aria-label={`Edit ${variant.label}`}
									onClick={() => onEdit(variant)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<IconEdit size={14} />
								</Button>
								<Button
									aria-label={`Delete ${variant.label}`}
									className="text-muted-foreground hover:text-destructive"
									onClick={() => onDeleteRequest(variant)}
									size="icon-xs"
									type="button"
									variant="ghost"
								>
									<IconTrash size={14} />
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			<FormSheet
				formId={EDIT_VARIANT_FORM_ID}
				isLoading={isUpdatePending}
				onOpenChange={onEditOpenChange}
				open={editingVariant !== null}
				title="Edit custom variant"
			>
				<form
					className="flex flex-col gap-3"
					id={EDIT_VARIANT_FORM_ID}
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="label">
						{(field) => (
							<Field
								error={field.state.meta.errors[0]?.message}
								htmlFor={`${EDIT_VARIANT_FORM_ID}-label`}
								label="Name"
								required
							>
								<Input
									id={`${EDIT_VARIANT_FORM_ID}-label`}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									value={field.state.value}
								/>
							</Field>
						)}
					</form.Field>
					<div className="grid grid-cols-3 gap-3">
						{BLIND_LABEL_FIELDS.map(({ name, label }) => (
							<form.Field key={name} name={name}>
								{(field) => (
									<Field
										error={field.state.meta.errors[0]?.message}
										htmlFor={`${EDIT_VARIANT_FORM_ID}-${name}`}
										label={label}
									>
										<Input
											id={`${EDIT_VARIANT_FORM_ID}-${name}`}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>
						))}
					</div>
				</form>
			</FormSheet>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						onDeleteCancel();
					}
				}}
				open={deletingVariant !== null}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete this custom variant?</DialogTitle>
						<DialogDescription>
							{deletingVariant?.label} will be removed from your variant list.
							Games and sessions that already use it keep the name.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex-row justify-end gap-2">
						<Button onClick={onDeleteCancel} type="button" variant="outline">
							Cancel
						</Button>
						<Button
							disabled={isDeletePending}
							onClick={onDeleteConfirm}
							type="button"
							variant="destructive"
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
