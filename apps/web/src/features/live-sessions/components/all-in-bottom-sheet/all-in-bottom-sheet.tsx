import { AllInFields } from "@/features/live-sessions/components/event-fields/all-in-fields";
import { cn } from "@/lib/utils";
import { FormSheet } from "@/shared/components/form-sheet";
import { Button } from "@/shared/components/ui/button";
import { formatNumber } from "@/utils/format-number";
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
	const { form, preview } = useAllInForm({ initialValues, open, onSubmit });

	const isEditMode = initialValues !== undefined;

	return (
		<FormSheet
			contentClassName={sheetClassName}
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
													{preview ? (
														<div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2.5 text-xs">
															<div className="flex items-center justify-between">
																<span className="text-muted-foreground">
																	Expected (
																	{formatNumber(
																		Number(potSizeField.state.value)
																	)}{" "}
																	× {equityField.state.value}%)
																</span>
																<span className="font-mono">
																	+{formatNumber(preview.expectedValue)}
																</span>
															</div>
															<div className="flex items-center justify-between">
																<span className="text-muted-foreground">
																	Realized
																</span>
																<span className="font-mono">
																	-{formatNumber(preview.realizedValue)}
																</span>
															</div>
															<div className="mt-1 flex items-center justify-between border-border border-t pt-1">
																<span className="font-semibold">EV delta</span>
																<span
																	className={cn(
																		"font-mono",
																		preview.evDelta >= 0
																			? "text-success"
																			: "text-destructive"
																	)}
																>
																	{preview.evDelta >= 0 ? "+" : ""}
																	{formatNumber(preview.evDelta)}
																</span>
															</div>
														</div>
													) : null}
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
					<Button onClick={onDelete} type="button" variant="destructive">
						Delete
					</Button>
				) : null}
			</form>
		</FormSheet>
	);
}
