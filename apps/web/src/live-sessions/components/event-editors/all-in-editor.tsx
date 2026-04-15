import { useForm } from "@tanstack/react-form";
import { AllInFields } from "@/live-sessions/components/event-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import {
	TimeField,
	toTimeInputValue,
	validateOccurredAtTime,
	toOccurredAtTimestamp,
	type EditorBaseProps,
} from "./shared";

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
	const payload = (event.payload ?? {}) as Record<string, unknown>;

	const form = useForm({
		defaultValues: {
			time: toTimeInputValue(event.occurredAt),
			potSize: typeof payload.potSize === "number" ? payload.potSize : 0,
			trials: typeof payload.trials === "number" ? payload.trials : 1,
			equity: typeof payload.equity === "number" ? payload.equity : 0,
			wins: typeof payload.wins === "number" ? payload.wins : 0,
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{
					potSize: value.potSize,
					trials: value.trials,
					equity: value.equity,
					wins: value.wins,
				},
				occurredAt
			);
		},
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
					onChange: ({ value }) =>
						validateOccurredAtTime(value, event.occurredAt, minTime, maxTime) ??
						undefined,
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
			<form.Subscribe selector={(state) => state.values}>
				{(values) => (
					<AllInFields
						equity={values.equity}
						onEquityChange={(v) => form.setFieldValue("equity", v)}
						onPotSizeChange={(v) => form.setFieldValue("potSize", v)}
						onTrialsChange={(v) => form.setFieldValue("trials", v)}
						onWinsChange={(v) => form.setFieldValue("wins", v)}
						potSize={values.potSize}
						trials={values.trials}
						wins={values.wins}
					/>
				)}
			</form.Subscribe>
			<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
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
