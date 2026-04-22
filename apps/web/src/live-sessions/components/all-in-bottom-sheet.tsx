import { AllInFields } from "@/live-sessions/components/event-fields/all-in-fields";
import { useAllInForm } from "@/live-sessions/hooks/use-all-in-form";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

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
		<ResponsiveDialog
			description="Capture the pot size, equity, and result for an all-in spot."
			onOpenChange={onOpenChange}
			open={open}
			title={isEditMode ? "Edit All-in" : "Add All-in"}
		>
			<form
				className="flex flex-col gap-4"
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
					<Button type="submit">{isEditMode ? "Save" : "Add All-in"}</Button>
				</DialogActionRow>
			</form>
		</ResponsiveDialog>
	);
}
