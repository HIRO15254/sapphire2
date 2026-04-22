import { AllInFields } from "@/live-sessions/components/event-fields/all-in-fields";
import { useAllInEditor } from "@/live-sessions/hooks/event-editors/use-all-in-editor";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { type EditorBaseProps, TimeField } from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
>;

export function AllInEditor({
	event,
	isLoading,
	maxTime,
	minTime,
	onSubmit,
}: Props) {
	const { form, timeValidator } = useAllInEditor({
		event,
		isLoading,
		maxTime,
		minTime,
		onSubmit,
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field
				name="time"
				validators={{
					onChange: ({ value }) => timeValidator(value),
				}}
			>
				{(field) => (
					<TimeField
						error={field.state.meta.errors[0]?.toString() ?? null}
						onChange={(v) => field.handleChange(v)}
						value={field.state.value}
					/>
				)}
			</form.Field>
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
												equityError={equityField.state.meta.errors[0]?.message}
												onEquityChange={(v) => equityField.handleChange(v)}
												onPotSizeChange={(v) => potSizeField.handleChange(v)}
												onTrialsChange={(v) => trialsField.handleChange(v)}
												onWinsChange={(v) => winsField.handleChange(v)}
												potSize={potSizeField.state.value}
												potSizeError={
													potSizeField.state.meta.errors[0]?.message
												}
												trials={trialsField.state.value}
												trialsError={trialsField.state.meta.errors[0]?.message}
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
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, isSubmitting]) => (
					<DialogActionRow>
						<Button
							disabled={!canSubmit || isSubmitting || isLoading}
							type="submit"
						>
							{isLoading ? "Saving..." : "Save"}
						</Button>
					</DialogActionRow>
				)}
			</form.Subscribe>
		</form>
	);
}
