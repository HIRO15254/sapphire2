import { IconTrash } from "@tabler/icons-react";
import { AllInFields } from "@/features/live-sessions/components/event-fields/all-in-fields";
import { BottomSheet } from "@/shared/components/bottom-sheet";
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
	sheetClassName?: string;
}

export function AllInBottomSheet({
	open,
	onOpenChange,
	initialValues,
	onSubmit,
	onDelete,
	sheetClassName,
}: AllInBottomSheetProps) {
	const { form } = useAllInForm({ initialValues, open, onSubmit });

	const isEditMode = initialValues !== undefined;

	return (
		<BottomSheet
			cancelLabel="Cancel"
			confirmLabel={isEditMode ? "Save" : "Log"}
			contentClassName={sheetClassName}
			formId={ALL_IN_FORM_ID}
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit All-in" : "Add All-in"}
		>
			<form
				className="flex flex-col gap-3"
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
												<>
													<AllInFields
														equity={equityField.state.value}
														equityError={
															equityField.state.meta.errors[0]?.message
														}
														onEquityChange={(v) => equityField.handleChange(v)}
														onPotSizeChange={(v) =>
															potSizeField.handleChange(v)
														}
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
												</>
											)}
										</form.Field>
									)}
								</form.Field>
							)}
						</form.Field>
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
		</BottomSheet>
	);
}
