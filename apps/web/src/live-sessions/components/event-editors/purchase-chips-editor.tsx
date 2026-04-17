import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { ChipPurchaseFields } from "@/live-sessions/components/event-fields/chip-purchase-fields";
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

const purchaseChipsSchema = z.object({
	time: z.string(),
	name: z.string().min(1, "Name is required"),
	cost: requiredNumericString({ integer: true, min: 0 }),
	chips: requiredNumericString({ integer: true, min: 0 }),
});

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
			cost: typeof payload.cost === "number" ? String(payload.cost) : "0",
			chips: typeof payload.chips === "number" ? String(payload.chips) : "0",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit(
				{
					name: value.name,
					cost: Math.round(Number(value.cost)),
					chips: Math.round(Number(value.chips)),
				},
				occurredAt
			);
		},
		validators: {
			onSubmit: purchaseChipsSchema,
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
			<form.Field name="name">
				{(nameField) => (
					<form.Field name="cost">
						{(costField) => (
							<form.Field name="chips">
								{(chipsField) => (
									<ChipPurchaseFields
										chips={chipsField.state.value}
										chipsError={chipsField.state.meta.errors[0]?.message}
										cost={costField.state.value}
										costError={costField.state.meta.errors[0]?.message}
										name={nameField.state.value}
										nameError={nameField.state.meta.errors[0]?.message}
										onChipsChange={(v) => chipsField.handleChange(v)}
										onCostChange={(v) => costField.handleChange(v)}
										onNameChange={(v) => nameField.handleChange(v)}
									/>
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
