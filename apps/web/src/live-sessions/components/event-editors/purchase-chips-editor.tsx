import { useForm } from "@tanstack/react-form";
import { ChipPurchaseFields } from "@/live-sessions/components/event-fields";
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

export function PurchaseChipsEditor({
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
			name: typeof payload.name === "string" ? payload.name : "",
			cost: typeof payload.cost === "number" ? payload.cost : 0,
			chips: typeof payload.chips === "number" ? payload.chips : 0,
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{ name: value.name, cost: value.cost, chips: value.chips },
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
					<ChipPurchaseFields
						chips={values.chips}
						cost={values.cost}
						name={values.name}
						onChipsChange={(v) => form.setFieldValue("chips", v)}
						onCostChange={(v) => form.setFieldValue("cost", v)}
						onNameChange={(v) => form.setFieldValue("name", v)}
					/>
				)}
			</form.Subscribe>
			<form.Field
				name="name"
				validators={{
					onChange: ({ value }) =>
						value.trim().length === 0 ? "Name is required" : undefined,
				}}
			>
				{() => null}
			</form.Field>
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
