import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { AllInFields } from "@/live-sessions/components/event-fields/all-in-fields";
import {
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/live-sessions/components/stack-editor-time";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { requiredNumericString } from "@/shared/lib/form-fields";
import { type EditorBaseProps, TimeField } from "./shared";

type Props = Pick<
	EditorBaseProps,
	"event" | "isLoading" | "maxTime" | "minTime" | "onSubmit"
>;

const allInSchema = z.object({
	time: z.string(),
	potSize: requiredNumericString({ min: 0 }),
	trials: requiredNumericString({ integer: true, min: 1 }),
	equity: requiredNumericString({ min: 0, max: 100 }),
	wins: requiredNumericString({ min: 0 }),
});

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
			potSize:
				typeof payload.potSize === "number" ? String(payload.potSize) : "0",
			trials: typeof payload.trials === "number" ? String(payload.trials) : "1",
			equity: typeof payload.equity === "number" ? String(payload.equity) : "0",
			wins: typeof payload.wins === "number" ? String(payload.wins) : "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{
					potSize: Number(value.potSize),
					trials: Number(value.trials),
					equity: Number(value.equity),
					wins: Number(value.wins),
				},
				occurredAt
			);
		},
		validators: {
			onSubmit: allInSchema,
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
