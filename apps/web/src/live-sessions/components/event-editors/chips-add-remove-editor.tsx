import { useForm } from "@tanstack/react-form";
import { AddonFields } from "@/live-sessions/components/event-fields";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/shared/components/ui/toggle-group";
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

export function ChipsAddRemoveEditor({
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
			amount: typeof payload.amount === "number" ? payload.amount : 0,
			type: (payload.type === "remove" ? "remove" : "add") as "add" | "remove",
		},
		onSubmit: ({ value }) => {
			const occurredAt = toOccurredAtTimestamp(event.occurredAt, value.time);
			onSubmit({ amount: value.amount, type: value.type }, occurredAt);
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
			<form.Field name="amount">
				{(field) => (
					<AddonFields
						amount={field.state.value}
						onAmountChange={(v) => field.handleChange(v)}
					/>
				)}
			</form.Field>
			<form.Field name="type">
				{(field) => (
					<Field htmlFor="edit-type" label="Type">
						<ToggleGroup
							onValueChange={(val) => {
								if (val) {
									field.handleChange(val as "add" | "remove");
								}
							}}
							type="single"
							value={field.state.value}
						>
							<ToggleGroupItem value="add">Add</ToggleGroupItem>
							<ToggleGroupItem value="remove">Remove</ToggleGroupItem>
						</ToggleGroup>
					</Field>
				)}
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
