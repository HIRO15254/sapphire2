import { AllInFields } from "@/features/live-sessions/components/event-fields/all-in-fields";
import { FormSheet } from "@/shared/components/form-sheet";
import { Button } from "@/shared/components/ui/button";
import { useAllInForm } from "./use-all-in-form";

const ALL_IN_FORM_ID = "all-in-form";

interface AllIn {
	equity: number;
	potSize: number;
	trials: number;
	wins: number;
}

interface AllInBottomSheetProps {
	initialValues?: AllIn;
	onDelete?: () => void;
	onOpenChange: (open: boolean) => void;
	onSubmit: (allIn: AllIn) => void;
	open: boolean;
}

/**
 * V2 form sheet for capturing an all-in spot. The FormSheet toolbar submits
 * the inner form via `formId`; the optional destructive Delete action stays
 * in the body below the fields.
 */
export function AllInBottomSheet({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	onDelete,
}: AllInBottomSheetProps) {
	const { form } = useAllInForm({ initialValues, open, onSubmit });

	const isEditMode = initialValues !== undefined;

	return (
		<FormSheet
			formId={ALL_IN_FORM_ID}
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit All-in" : "Add All-in"}
		>
			<form
				className="flex flex-col gap-4"
				id={ALL_IN_FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="potSize">
					{(potSizeField) => (
						<form.Field name="trials">
							{(trialsField) => (
								<form.Field name="equity">
									{(equityField) => (
										<form.Field name="wins">
											{(winsField) => (
												<AllInFields
													equity={equityField.state.value}
													equityError={
														equityField.state.meta.errors[0]?.message
													}
													onEquityChange={(v) => equityField.handleChange(v)}
													onPotSizeChange={(v) => potSizeField.handleChange(v)}
													onTrialsChange={(v) => trialsField.handleChange(v)}
													onWinsChange={(v) => winsField.handleChange(v)}
													potSize={potSizeField.state.value}
													potSizeError={
														potSizeField.state.meta.errors[0]?.message
													}
													trials={trialsField.state.value}
													trialsError={
														trialsField.state.meta.errors[0]?.message
													}
													wins={winsField.state.value}
													winsError={winsField.state.meta.errors[0]?.message}
												/>
											)}
										</form.Field>
									)}
								</form.Field>
							)}
						</form.Field>
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
